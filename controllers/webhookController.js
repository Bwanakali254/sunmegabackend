const mongoose = require('mongoose')
const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const User = require('../models/User')
const { verifyWebhookSignature } = require('../services/paypalService')
const { sendOrderConfirmationEmail } = require('../utils/emailService')
const logger = require('../utils/logger')

/**
 * @desc    Handle PayPal webhook events
 * @route   POST /api/webhooks/paypal
 * @access  Public (verified by signature)
 */
const handlePayPalWebhook = async (req, res) => {
  // PayPal requires 200 response immediately to acknowledge receipt
  res.status(200).json({ received: true })

  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID
    if (!webhookId) {
      logger.error('PAYPAL_WEBHOOK_ID not configured')
      return
    }

    // Get raw body for signature verification
    // req.body is Buffer from express.raw() middleware
    const rawBody = req.body.toString('utf8')
    const headers = req.headers
    
    // Parse body for event processing
    let event
    try {
      event = JSON.parse(rawBody)
    } catch (parseError) {
      logger.error('Failed to parse webhook body:', parseError)
      return
    }

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(headers, rawBody, webhookId)
    if (!isValid) {
      logger.error('PayPal webhook signature verification failed')
      return
    }

    const eventType = event.event_type

    logger.info('PayPal webhook received:', {
      eventType,
      resourceType: event.resource_type,
      id: event.id
    })

    // Handle different event types
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      // Order approved but not yet captured - just log
      logger.info('PayPal order approved:', {
        orderId: event.resource?.id,
        status: event.resource?.status
      })
      return
    }

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      await handlePaymentCaptureCompleted(event)
      return
    }

    // Log unhandled event types
    logger.info('Unhandled PayPal webhook event type:', eventType)
  } catch (error) {
    logger.error('PayPal webhook handler error:', error)
  }
}

/**
 * Handle PAYMENT.CAPTURE.COMPLETED event
 * This is the primary fulfillment trigger from PayPal
 */
const handlePaymentCaptureCompleted = async (event) => {
  try {
    const capture = event.resource
    const paypalOrderId = capture.supplementary_data?.related_ids?.order_id

    if (!paypalOrderId) {
      logger.error('PayPal webhook missing order ID:', event)
      return
    }

    // Locate order by paypalOrderId
    const order = await Order.findOne({ paypalOrderId })

    if (!order) {
      logger.error('Order not found for PayPal webhook:', {
        paypalOrderId,
        captureId: capture.id
      })
      return
    }

    // IDEMPOTENCY CHECK: If order is already paid, exit
    if (order.paymentStatus === 'paid') {
      logger.info('Order already fulfilled (idempotent check):', {
        orderId: order._id,
        paypalOrderId
      })
      return
    }

    // Verify amount and currency AGAIN (defense in depth)
    const capturedAmount = parseFloat(capture.amount?.value || 0)
    const orderTotal = parseFloat(order.total)
    const amountDifference = Math.abs(capturedAmount - orderTotal)
    const tolerance = 0.01

    if (amountDifference > tolerance) {
      logger.error('Amount mismatch in webhook:', {
        capturedAmount,
        orderTotal,
        paypalOrderId,
        orderId: order._id
      })
      return
    }

    const expectedCurrency = 'USD'
    const capturedCurrency = capture.amount?.currency_code
    if (capturedCurrency && capturedCurrency !== expectedCurrency) {
      logger.warn('Currency mismatch in webhook:', {
        captured: capturedCurrency,
        expected: expectedCurrency,
        orderId: order._id
      })
      // Non-fatal, but log it
    }

    // Use MongoDB transaction for atomic fulfillment
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // 1. Mark order as paid (within transaction)
      order.paymentStatus = 'paid'
      order.orderStatus = 'confirmed'
      order.paymentId = capture.id || paypalOrderId
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
        cart.total = 0
        await cart.save({ session })
      }

      // Commit transaction - all or nothing
      await session.commitTransaction()
      logger.info('PayPal webhook fulfillment completed (transaction committed):', {
        orderId: order._id,
        paypalOrderId,
        amount: capturedAmount
      })

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
    } catch (transactionError) {
      // Rollback transaction on any error
      await session.abortTransaction()
      logger.error('CRITICAL: PayPal webhook fulfillment transaction failed:', {
        orderId: order._id,
        paypalOrderId,
        error: transactionError
      })
      throw transactionError
    } finally {
      session.endSession()
    }
  } catch (error) {
    logger.error('PayPal webhook payment capture handler error:', error)
  }
}

module.exports = {
  handlePayPalWebhook
}
