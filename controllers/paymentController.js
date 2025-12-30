const Order = require('../models/Order')
const { submitOrder, getPaymentStatus, verifyIPN } = require('../services/pesapalService')
const logger = require('../utils/logger')

/**
 * @desc    Initiate payment for order
 * @route   POST /api/payments/initiate
 * @access  Private
 */
const initiatePayment = async (req, res, next) => {
  try {
    const { orderId } = req.body

    // Get order
    const order = await Order.findOne({
      _id: orderId,
      userId: req.user.id
    }).populate('userId')

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      })
    }

    // Check if order is already paid
    if (order.paymentStatus === 'paid') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Order is already paid',
          code: 'ALREADY_PAID'
        }
      })
    }

    // Check if order is cancelled
    if (order.orderStatus === 'cancelled') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cannot pay for cancelled order',
          code: 'ORDER_CANCELLED'
        }
      })
    }

    // Prepare order data for Pesapal
    const orderData = {
      orderId: order._id.toString(),
      amount: order.total,
      currency: 'KES',
      description: `Payment for order ${order.orderNumber}`,
      customerEmail: order.shippingAddress.email,
      customerPhone: order.shippingAddress.phone,
      customerName: order.shippingAddress.name,
      reference: order.orderNumber
    }

    // Submit to Pesapal
    const paymentResponse = await submitOrder(orderData)

    // Update order with tracking ID
    order.paymentId = paymentResponse.orderTrackingId
    order.paymentStatus = 'processing'
    await order.save()

    res.json({
      success: true,
      data: {
        redirectUrl: paymentResponse.redirectUrl,
        orderTrackingId: paymentResponse.orderTrackingId,
        orderId: order._id,
        message: 'Payment initiated successfully. Redirect to Pesapal to complete payment.'
      }
    })
  } catch (error) {
    logger.error('Initiate payment error:', error)
    next(error)
  }
}

/**
 * @desc    Handle Pesapal callback
 * @route   GET /api/payments/pesapal/callback
 * @access  Public
 */
const pesapalCallback = async (req, res, next) => {
  try {
    const { OrderTrackingId, OrderMerchantReference } = req.query

    if (!OrderTrackingId) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment?status=error&message=Missing tracking ID`)
    }

    // Get order by order number
    const order = await Order.findOne({ orderNumber: OrderMerchantReference })

    if (!order) {
      return res.redirect(`${process.env.FRONTEND_URL}/payment?status=error&message=Order not found`)
    }

    // Verify payment status with Pesapal
    const paymentStatus = await getPaymentStatus(OrderTrackingId)

    // Update order payment status (Pesapal returns status as string like "COMPLETED", "FAILED")
    const statusUpper = paymentStatus.paymentStatus?.toUpperCase() || ''
    if (statusUpper === 'COMPLETED') {
      const wasPending = order.paymentStatus !== 'paid'
      order.paymentStatus = 'paid'
      if (order.orderStatus === 'pending') {
        order.orderStatus = 'confirmed'
      }
      
      // Send order confirmation email if payment just completed
      if (wasPending) {
        try {
          const User = require('../models/User')
          const { sendOrderConfirmationEmail } = require('../utils/emailService')
          const user = await User.findById(order.userId)
          if (user && user.email) {
            await sendOrderConfirmationEmail(order, user)
          }
        } catch (emailError) {
          logger.error('Error sending order confirmation email:', emailError)
        }
      }
    } else if (statusUpper === 'FAILED') {
      order.paymentStatus = 'failed'
    } else {
      order.paymentStatus = 'processing'
    }

    order.paymentId = OrderTrackingId
    await order.save()

    // Redirect to frontend
    const redirectUrl = paymentStatus.paymentStatus === 'COMPLETED'
      ? `${process.env.FRONTEND_URL}/payment?status=success&orderId=${order._id}`
      : `${process.env.FRONTEND_URL}/payment?status=failed&orderId=${order._id}`

    res.redirect(redirectUrl)
  } catch (error) {
    logger.error('Pesapal callback error:', error)
    res.redirect(`${process.env.FRONTEND_URL}/payment?status=error&message=Payment verification failed`)
  }
}

/**
 * @desc    Handle Pesapal IPN (Instant Payment Notification)
 * @route   POST /api/payments/pesapal/ipn
 * @access  Public
 */
const pesapalIPN = async (req, res, next) => {
  try {
    const { OrderTrackingId, OrderMerchantReference, OrderNotificationType } = req.body

    logger.info('Pesapal IPN received:', { OrderTrackingId, OrderMerchantReference, OrderNotificationType })

    // Verify IPN
    const verification = await verifyIPN(OrderTrackingId, OrderMerchantReference)

    // Get order
    const order = await Order.findOne({ orderNumber: OrderMerchantReference })

    if (!order) {
      logger.error('Order not found for IPN:', OrderMerchantReference)
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      })
    }

    // Update order based on payment status (Pesapal returns status as string)
    const statusUpper = verification.paymentStatus?.toUpperCase() || ''
    if (statusUpper === 'COMPLETED') {
      const wasPending = order.paymentStatus !== 'paid'
      order.paymentStatus = 'paid'
      if (order.orderStatus === 'pending') {
        order.orderStatus = 'confirmed'
      }
      
      // Send order confirmation email if payment just completed
      if (wasPending) {
        try {
          const User = require('../models/User')
          const { sendOrderConfirmationEmail } = require('../utils/emailService')
          const user = await User.findById(order.userId)
          if (user && user.email) {
            await sendOrderConfirmationEmail(order, user)
          }
        } catch (emailError) {
          logger.error('Error sending order confirmation email:', emailError)
        }
      }
    } else if (statusUpper === 'FAILED') {
      order.paymentStatus = 'failed'
    }

    order.paymentId = OrderTrackingId
    await order.save()

    logger.info('Order payment status updated:', {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus
    })

    res.json({
      success: true,
      message: 'IPN processed successfully'
    })
  } catch (error) {
    logger.error('Pesapal IPN error:', error)
    next(error)
  }
}

/**
 * @desc    Check payment status
 * @route   GET /api/payments/status/:orderId
 * @access  Private
 */
const checkPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params

    const order = await Order.findOne({
      _id: orderId,
      userId: req.user.id
    })

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      })
    }

    // If payment ID exists, check with Pesapal
    if (order.paymentId) {
      try {
        const paymentStatus = await getPaymentStatus(order.paymentId)
        
        // Update order if status changed (Pesapal returns status as string)
        const statusUpper = paymentStatus.paymentStatus?.toUpperCase() || ''
        if (statusUpper === 'COMPLETED' && order.paymentStatus !== 'paid') {
          order.paymentStatus = 'paid'
          if (order.orderStatus === 'pending') {
            order.orderStatus = 'confirmed'
          }
          await order.save()
          
          // Send order confirmation email
          try {
            const User = require('../models/User')
            const { sendOrderConfirmationEmail } = require('../utils/emailService')
            const user = await User.findById(order.userId)
            if (user && user.email) {
              await sendOrderConfirmationEmail(order, user)
            }
          } catch (emailError) {
            logger.error('Error sending order confirmation email:', emailError)
          }
        } else if (statusUpper === 'FAILED' && order.paymentStatus !== 'failed') {
          order.paymentStatus = 'failed'
          await order.save()
        }

        return res.json({
          success: true,
          data: {
            order: {
              _id: order._id,
              orderNumber: order.orderNumber,
              paymentStatus: order.paymentStatus,
              orderStatus: order.orderStatus,
              total: order.total
            },
            pesapalStatus: paymentStatus
          }
        })
      } catch (error) {
        logger.error('Error checking payment status with Pesapal:', error)
        // Return order status even if Pesapal check fails
      }
    }

    res.json({
      success: true,
      data: {
        order: {
          _id: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          total: order.total
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  initiatePayment,
  pesapalCallback,
  pesapalIPN,
  checkPaymentStatus
}

