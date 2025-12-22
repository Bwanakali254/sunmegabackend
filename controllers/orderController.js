const Order = require('../models/Order')
const Cart = require('../models/Cart')
const Product = require('../models/Product')
const logger = require('../utils/logger')

/**
 * @desc    Create order from cart
 * @route   POST /api/orders
 * @access  Private
 */
const createOrder = async (req, res, next) => {
  try {
    const {
      shippingAddress,
      deliveryMethod = 'home',
      paymentMethod,
      notes
    } = req.body

    // Get user's cart
    const cart = await Cart.findOne({ userId: req.user.id })
      .populate('items.productId')

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cart is empty',
          code: 'EMPTY_CART'
        }
      })
    }

    // Validate all products are still available
    const orderItems = []
    let subtotal = 0

    for (const cartItem of cart.items) {
      const product = cartItem.productId

      if (!product || !product.active) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Product ${product?.name || 'Unknown'} is no longer available`,
            code: 'PRODUCT_UNAVAILABLE'
          }
        })
      }

      if (product.stock < cartItem.quantity) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${cartItem.quantity}`,
            code: 'INSUFFICIENT_STOCK'
          }
        })
      }

      const itemTotal = cartItem.price * cartItem.quantity
      subtotal += itemTotal

      orderItems.push({
        productId: product._id,
        name: product.name,
        quantity: cartItem.quantity,
        price: cartItem.price,
        total: itemTotal
      })
    }

    // Calculate shipping
    const shipping = deliveryMethod === 'pickup' ? 0 : 50
    const tax = 0 // Can be calculated based on location
    const total = subtotal + shipping + tax

    // Create order
    const order = await Order.create({
      userId: req.user.id,
      items: orderItems,
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress,
      deliveryMethod,
      paymentMethod,
      notes
    })

    // Update product stock
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: -item.quantity }
      })
    }

    // Clear cart
    cart.items = []
    await cart.save()

    res.status(201).json({
      success: true,
      data: {
        order,
        message: 'Order created successfully'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get user's orders
 * @route   GET /api/orders
 * @access  Private
 */
const getOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 10 } = req.query

    const query = { userId: req.user.id }
    if (status) {
      query.orderStatus = status
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const orders = await Order.find(query)
      .populate('items.productId', 'name images')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Order.countDocuments(query)

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get single order
 * @route   GET /api/orders/:id
 * @access  Private
 */
const getOrder = async (req, res, next) => {
  try {
    const { id } = req.params

    const order = await Order.findOne({
      _id: id,
      userId: req.user.id
    })
      .populate('items.productId', 'name images description')

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      })
    }

    res.json({
      success: true,
      data: {
        order
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update order status (Admin only)
 * @route   PUT /api/orders/:id/status
 * @access  Private/Admin
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { orderStatus, trackingNumber } = req.body

    const order = await Order.findById(id)
    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      })
    }

    if (orderStatus) {
      order.orderStatus = orderStatus
    }

    if (trackingNumber) {
      order.trackingNumber = trackingNumber
    }

    await order.save()

    res.json({
      success: true,
      data: {
        order,
        message: 'Order status updated'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update payment status
 * @route   PUT /api/orders/:id/payment
 * @access  Private
 */
const updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { paymentStatus, paymentId } = req.body

    const order = await Order.findOne({
      _id: id,
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

    if (paymentStatus) {
      order.paymentStatus = paymentStatus
    }

    if (paymentId) {
      order.paymentId = paymentId
    }

    await order.save()

    res.json({
      success: true,
      data: {
        order,
        message: 'Payment status updated'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Cancel order
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { id } = req.params

    const order = await Order.findOne({
      _id: id,
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

    // Only allow cancellation if order is pending or confirmed
    if (!['pending', 'confirmed'].includes(order.orderStatus)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Order cannot be cancelled at this stage',
          code: 'CANCEL_NOT_ALLOWED'
        }
      })
    }

    // Restore product stock
    for (const item of order.items) {
      await Product.findByIdAndUpdate(item.productId, {
        $inc: { stock: item.quantity }
      })
    }

    order.orderStatus = 'cancelled'
    await order.save()

    res.json({
      success: true,
      data: {
        order,
        message: 'Order cancelled successfully'
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder
}

