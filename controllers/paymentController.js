const mongoose = require('mongoose')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const User = require('../models/User')
const { submitOrder, getPaymentStatus, verifyIPN } = require('../services/pesapalService')
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
const pesapalCallback = async (req, res, _next) => {
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

    // IDEMPOTENCY CHECK: If order is already paid, redirect to success (idempotent)
    if (order.paymentStatus === 'paid') {
      logger.info('Order already fulfilled (idempotent check in callback):', {
        orderId: order._id,
        orderNumber: OrderMerchantReference
      })
      return res.redirect(`${process.env.FRONTEND_URL}/payment?status=success&orderId=${order._id}`)
    }

    // Verify payment status with Pesapal
    const paymentStatus = await getPaymentStatus(OrderTrackingId)

    // Update order payment status (Pesapal returns status as string like "COMPLETED", "FAILED")
    const statusUpper = paymentStatus.paymentStatus?.toUpperCase() || ''
    if (statusUpper === 'COMPLETED') {
      // AMOUNT VERIFICATION: Verify payment amount matches order total
      const paidAmount = parseFloat(paymentStatus.amount || 0)
      const orderTotal = parseFloat(order.total)
      const amountDifference = Math.abs(paidAmount - orderTotal)
      const tolerance = 0.01 // Allow 0.01 tolerance for rounding

      if (amountDifference > tolerance) {
        logger.error('Amount mismatch in Pesapal callback:', {
          paidAmount,
          orderTotal,
          difference: amountDifference,
          orderId: order._id,
          orderNumber: OrderMerchantReference
        })
        order.paymentStatus = 'failed'
        order.paymentId = OrderTrackingId
        await order.save()
        return res.redirect(`${process.env.FRONTEND_URL}/payment?status=error&message=Payment amount mismatch`)
      }

      // FULFILLMENT: Use MongoDB transaction for atomic operations
      const session = await mongoose.startSession()
      session.startTransaction()

      try {
        // 1. Update order status (within transaction)
        order.paymentStatus = 'paid'
        if (order.orderStatus === 'pending') {
          order.orderStatus = 'confirmed'
        }
        order.paymentId = OrderTrackingId
        await order.save({ session })

        // 2. Reduce product stock (atomic within transaction)
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: -item.quantity } },
            { session }
          )
        }

        // 3. Clear user's cart (atomic within transaction)
        const cart = await Cart.findOne({ userId: order.userId }).session(session)
        if (cart) {
          cart.items = []
          await cart.save({ session })
        }

        // Commit transaction - all or nothing
        await session.commitTransaction()
        logger.info('Pesapal callback fulfillment completed (transaction committed):', {
          orderId: order._id,
          orderNumber: OrderMerchantReference,
          amount: paidAmount
        })
      } catch (transactionError) {
        // Rollback transaction on any error
        await session.abortTransaction()
        logger.error('CRITICAL: Pesapal callback fulfillment transaction failed:', {
          orderId: order._id,
          orderNumber: OrderMerchantReference,
          error: transactionError
        })
        throw transactionError
      } finally {
        session.endSession()
      }

      // 4. Send order confirmation email (outside transaction - non-critical)
      try {
        const user = await User.findById(order.userId)
        if (user && user.email) {
          await sendOrderConfirmationEmail(order, user)
        }
      } catch (emailError) {
        // Email failure should not fail the payment
        logger.error('Error sending order confirmation email:', emailError)
      }
    } else if (statusUpper === 'FAILED') {
      order.paymentStatus = 'failed'
      order.paymentId = OrderTrackingId
      await order.save()
    } else {
      // Other statuses (e.g., PENDING) - just update tracking ID and status
      order.paymentStatus = 'processing'
      order.paymentId = OrderTrackingId
      await order.save()
    }

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

    // IDEMPOTENCY CHECK: If order is already paid, exit immediately
    if (order.paymentStatus === 'paid') {
      logger.info('Order already fulfilled (idempotent check):', {
        orderId: order._id,
        orderNumber: OrderMerchantReference
      })
      return res.json({
        success: true,
        message: 'IPN processed successfully (order already fulfilled)'
      })
    }

    // Update order based on payment status (Pesapal returns status as string)
    const statusUpper = verification.paymentStatus?.toUpperCase() || ''
    if (statusUpper === 'COMPLETED') {
      // AMOUNT VERIFICATION: Verify payment amount matches order total
      const paidAmount = parseFloat(verification.amount || 0)
      const orderTotal = parseFloat(order.total)
      const amountDifference = Math.abs(paidAmount - orderTotal)
      const tolerance = 0.01 // Allow 0.01 tolerance for rounding

      if (amountDifference > tolerance) {
        logger.error('Amount mismatch in Pesapal IPN:', {
          paidAmount,
          orderTotal,
          difference: amountDifference,
          orderId: order._id,
          orderNumber: OrderMerchantReference
        })
        order.paymentStatus = 'failed'
        await order.save()
        return res.status(400).json({
          success: false,
          error: {
            message: 'Payment amount does not match order total',
            code: 'AMOUNT_MISMATCH'
          }
        })
      }

      // FULFILLMENT: Use MongoDB transaction for atomic operations
      const session = await mongoose.startSession()
      session.startTransaction()

      try {
        // 1. Update order status (within transaction)
        order.paymentStatus = 'paid'
        if (order.orderStatus === 'pending') {
          order.orderStatus = 'confirmed'
        }
        order.paymentId = OrderTrackingId
        await order.save({ session })

        // 2. Reduce product stock (atomic within transaction)
        for (const item of order.items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { stock: -item.quantity } },
            { session }
          )
        }

        // 3. Clear user's cart (atomic within transaction)
        const cart = await Cart.findOne({ userId: order.userId }).session(session)
        if (cart) {
          cart.items = []
          await cart.save({ session })
        }

        // Commit transaction - all or nothing
        await session.commitTransaction()
        logger.info('Pesapal IPN fulfillment completed (transaction committed):', {
          orderId: order._id,
          orderNumber: OrderMerchantReference,
          amount: paidAmount
        })
      } catch (transactionError) {
        // Rollback transaction on any error
        await session.abortTransaction()
        logger.error('CRITICAL: Pesapal IPN fulfillment transaction failed:', {
          orderId: order._id,
          orderNumber: OrderMerchantReference,
          error: transactionError
        })
        throw transactionError
      } finally {
        session.endSession()
      }

      // 4. Send order confirmation email (outside transaction - non-critical)
      try {
        const user = await User.findById(order.userId)
        if (user && user.email) {
          await sendOrderConfirmationEmail(order, user)
        }
      } catch (emailError) {
        // Email failure should not fail the payment
        logger.error('Error sending order confirmation email:', emailError)
      }
    } else if (statusUpper === 'FAILED') {
      order.paymentStatus = 'failed'
      order.paymentId = OrderTrackingId
      await order.save()
    } else {
      // Other statuses (e.g., PENDING) - just update tracking ID
      order.paymentId = OrderTrackingId
      await order.save()
    }

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
 * @desc    Check payment status (READ-ONLY)
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

    let pesapalStatus = null

    // READ-ONLY: query Pesapal if paymentId exists
    if (order.paymentId) {
      try {
        pesapalStatus = await getPaymentStatus(order.paymentId)
      } catch (error) {
        logger.error('Error checking payment status with Pesapal:', error)
        // Do NOT fail — backend order state is still authoritative
      }
    }

    // IMPORTANT: No state mutation here
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
        pesapalStatus
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

