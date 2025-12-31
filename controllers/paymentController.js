const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const User = require('../models/User')
const { submitOrder, getPaymentStatus, verifyIPN } = require('../services/pesapalService')
const { createOrder: createPayPalOrderAPI, captureOrder: capturePayPalOrder } = require('../services/paypalService')
const { sendOrderConfirmationEmail } = require('../utils/emailService')
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

/**
 * @desc    Create PayPal order for payment
 * @route   POST /api/payments/paypal/create
 * @access  Private
 */
const createPayPalOrder = async (req, res, next) => {
  try {
    const { orderId } = req.body

    // Validate orderId is provided
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Order ID is required',
          code: 'ORDER_ID_REQUIRED'
        }
      })
    }

    // Get order and validate it exists
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

    // Validate order payment status is pending
    if (order.paymentStatus !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Order payment status is ${order.paymentStatus}. Only pending orders can create PayPal payments.`,
          code: 'INVALID_ORDER_STATUS'
        }
      })
    }

    // Create PayPal order using backend order data
    // Amount MUST come from backend order total (not frontend)
    const paypalResponse = await createPayPalOrderAPI({
      amount: order.total, // Backend authority for amount
      currency: 'USD', // PayPal typically uses USD, adjust if needed
      orderId: order._id.toString(),
      orderNumber: order.orderNumber
    })

    if (!paypalResponse.success || !paypalResponse.paypalOrderId) {
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to create PayPal order',
          code: 'PAYPAL_ORDER_CREATION_FAILED'
        }
      })
    }

    // Save PayPal order ID to order document
    order.paypalOrderId = paypalResponse.paypalOrderId
    order.paymentStatus = 'processing' // Update to processing while awaiting payment
    await order.save()

    // Return ONLY paypalOrderId as required
    res.json({
      success: true,
      data: {
        paypalOrderId: paypalResponse.paypalOrderId
      }
    })
  } catch (error) {
    logger.error('Create PayPal order error:', error)
    next(error)
  }
}

/**
 * @desc    Capture PayPal payment and fulfill order
 * @route   POST /api/payments/paypal/capture
 * @access  Private
 */
const capturePayPalPayment = async (req, res, next) => {
  try {
    const { paypalOrderId } = req.body

    // Validate paypalOrderId is provided
    if (!paypalOrderId) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'PayPal order ID is required',
          code: 'PAYPAL_ORDER_ID_REQUIRED'
        }
      })
    }

    // Fetch order by paypalOrderId
    const order = await Order.findOne({
      paypalOrderId: paypalOrderId,
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

    // Validate paymentStatus is 'processing'
    if (order.paymentStatus !== 'processing') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Order payment status is ${order.paymentStatus}. Only processing orders can be captured.`,
          code: 'INVALID_ORDER_STATUS'
        }
      })
    }

    // Call PayPal CAPTURE API
    let captureResponse
    try {
      captureResponse = await capturePayPalOrder(paypalOrderId)
    } catch (error) {
      logger.error('PayPal capture failed:', error)
      return res.status(500).json({
        success: false,
        error: {
          message: 'Failed to capture PayPal payment',
          code: 'PAYPAL_CAPTURE_FAILED'
        }
      })
    }

    // Verify PayPal response
    if (!captureResponse.success || captureResponse.status !== 'COMPLETED') {
      logger.warn('PayPal capture not completed:', captureResponse)
      return res.status(400).json({
        success: false,
        error: {
          message: 'PayPal payment was not completed',
          code: 'PAYMENT_NOT_COMPLETED'
        }
      })
    }

    // Verify amount matches backend order total
    const capturedAmount = parseFloat(captureResponse.amount)
    const orderTotal = parseFloat(order.total)
    const amountDifference = Math.abs(capturedAmount - orderTotal)
    const tolerance = 0.01 // Allow 1 cent difference for rounding

    if (amountDifference > tolerance) {
      logger.error('Amount mismatch:', {
        capturedAmount,
        orderTotal,
        paypalOrderId,
        orderId: order._id
      })
      return res.status(400).json({
        success: false,
        error: {
          message: 'Payment amount does not match order total',
          code: 'AMOUNT_MISMATCH'
        }
      })
    }

    // Verify currency matches (if order has currency field, otherwise assume USD for PayPal)
    // Note: Order model doesn't have currency field, PayPal uses USD by default
    const expectedCurrency = 'USD'
    if (captureResponse.currency && captureResponse.currency !== expectedCurrency) {
      logger.warn('Currency mismatch:', {
        captured: captureResponse.currency,
        expected: expectedCurrency
      })
      // Non-fatal, but log it
    }

    // ONLY AFTER VERIFICATION - Fulfill order
    // All operations must succeed or none should be applied
    try {
      // 1. Update order status
      order.paymentStatus = 'paid'
      order.orderStatus = 'confirmed'
      order.paymentId = captureResponse.captureId || paypalOrderId
      await order.save()

      // 2. Reduce product stock (atomic operations)
      for (const item of order.items) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { stock: -item.quantity }
        })
      }

      // 3. Clear user's cart
      const cart = await Cart.findOne({ userId: order.userId })
      if (cart) {
        cart.items = []
        cart.total = 0
        await cart.save()
      }

      // 4. Send order confirmation email
      try {
        const user = await User.findById(order.userId)
        if (user && user.email) {
          await sendOrderConfirmationEmail(order, user)
        }
      } catch (emailError) {
        // Email failure should not fail the payment
        logger.error('Error sending order confirmation email:', emailError)
      }

      logger.info('PayPal payment captured and order fulfilled:', {
        orderId: order._id,
        paypalOrderId,
        amount: capturedAmount
      })

      res.json({
        success: true,
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          message: 'Payment captured and order fulfilled successfully'
        }
      })
    } catch (fulfillmentError) {
      // If fulfillment fails, log error but payment is already captured
      // This is a critical error - payment succeeded but fulfillment failed
      logger.error('CRITICAL: Payment captured but fulfillment failed:', {
        orderId: order._id,
        paypalOrderId,
        error: fulfillmentError
      })

      // Try to mark order as needing manual review
      try {
        order.paymentStatus = 'paid'
        order.orderStatus = 'pending' // Keep as pending for manual review
        await order.save()
      } catch (saveError) {
        logger.error('Failed to update order status after fulfillment error:', saveError)
      }

      return res.status(500).json({
        success: false,
        error: {
          message: 'Payment captured but order fulfillment failed. Please contact support.',
          code: 'FULFILLMENT_FAILED'
        }
      })
    }
  } catch (error) {
    logger.error('Capture PayPal payment error:', error)
    next(error)
  }
}

module.exports = {
  initiatePayment,
  pesapalCallback,
  pesapalIPN,
  checkPaymentStatus,
  createPayPalOrder,
  capturePayPalPayment
}

