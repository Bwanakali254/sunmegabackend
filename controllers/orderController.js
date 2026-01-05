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
    /**
     * ORDER VALIDATION: Strict validation ensures data integrity
     * 
     * Validation middleware runs before this controller, but we add defensive checks
     * to ensure no silent failures and provide clear error messages.
     * 
     * Required fields (validated by Joi schema):
     * - shippingAddress: { name, phone, email, street, city } (required)
     * - paymentMethod: 'pesapal' | 'mpesa' | 'card' | 'cash' (required)
     * 
     * Optional fields:
     * - deliveryMethod: 'home' | 'pickup' (default: 'home')
     * - notes: string (max 1000 chars)
     * - shippingAddress.state: string (optional)
     * - shippingAddress.zipCode: string (optional)
     * - shippingAddress.country: string (default: 'Kenya')
     */
    const {
      shippingAddress,
      deliveryMethod = 'home',
      paymentMethod,
      notes
    } = req.body

    // DEFENSIVE VALIDATION: Ensure shippingAddress exists (should be caught by Joi, but fail fast if not)
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Shipping address is required',
          code: 'SHIPPING_ADDRESS_REQUIRED',
          field: 'shippingAddress'
        }
      })
    }

    // DEFENSIVE VALIDATION: Ensure required shippingAddress fields exist
    const requiredFields = ['name', 'phone', 'email', 'street', 'city']
    const missingFields = requiredFields.filter(field => !shippingAddress[field] || (typeof shippingAddress[field] === 'string' && !shippingAddress[field].trim()))
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Missing required shipping address fields: ${missingFields.join(', ')}`,
          code: 'SHIPPING_ADDRESS_INCOMPLETE',
          fields: missingFields
        }
      })
    }

    // DEFENSIVE VALIDATION: Ensure paymentMethod exists
    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Payment method is required',
          code: 'PAYMENT_METHOD_REQUIRED',
          field: 'paymentMethod'
        }
      })
    }

    // DEFENSIVE VALIDATION: Ensure paymentMethod is valid enum value
    const validPaymentMethods = ['pesapal', 'mpesa', 'card', 'cash']
    if (!validPaymentMethods.includes(paymentMethod)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid payment method. Must be one of: ${validPaymentMethods.join(', ')}`,
          code: 'INVALID_PAYMENT_METHOD',
          field: 'paymentMethod',
          received: paymentMethod,
          valid: validPaymentMethods
        }
      })
    }

    // DEFENSIVE VALIDATION: Ensure deliveryMethod is valid enum value
    const validDeliveryMethods = ['home', 'pickup']
    if (!validDeliveryMethods.includes(deliveryMethod)) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Invalid delivery method. Must be one of: ${validDeliveryMethods.join(', ')}`,
          code: 'INVALID_DELIVERY_METHOD',
          field: 'deliveryMethod',
          received: deliveryMethod,
          valid: validDeliveryMethods
        }
      })
    }

    // Re-fetch user's cart immediately before validation
    // CART INTEGRITY: Populate products to validate they still exist
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

    /**
     * CART INTEGRITY: Filter out invalid items before order creation
     * 
     * Prevents order creation failures due to:
     * - Deleted products (productId is null)
     * - Inactive products (product.active is false)
     * 
     * If cart becomes empty after filtering, return error
     */
    const validCartItems = cart.items.filter(item => {
      if (!item.productId) {
        logger.warn(`Order creation blocked: Cart item ${item._id} has null productId (product deleted)`)
        return false
      }
      if (item.productId.active === false) {
        logger.warn(`Order creation blocked: Cart item ${item._id} references inactive product ${item.productId._id}`)
        return false
      }
      return true
    })

    // If all items are invalid, return error (cart corruption detected)
    if (validCartItems.length === 0) {
      // Sanitize cart by removing invalid items
      cart.items = []
      await cart.save()
      
      return res.status(400).json({
        success: false,
        error: {
          message: 'Cart contains only unavailable products. Please add valid products to your cart.',
          code: 'CART_CORRUPTED'
        }
      })
    }

    // If some items are invalid, sanitize cart but continue with valid items
    if (validCartItems.length < cart.items.length) {
      const removedCount = cart.items.length - validCartItems.length
      logger.warn(`Order creation: Removed ${removedCount} invalid item(s) from cart. Continuing with ${validCartItems.length} valid item(s).`)
      cart.items = validCartItems
      await cart.save()
    }

    const orderItems = []
    let subtotal = 0

    // Use sanitized cart items (already validated above)
    for (const cartItem of validCartItems) {
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

      // ✅ Backend-authoritative pricing
      const itemPrice = product.price
      const itemTotal = itemPrice * cartItem.quantity
      subtotal += itemTotal

      orderItems.push({
        productId: product._id,
        name: product.name,
        quantity: cartItem.quantity,
        price: itemPrice,
        total: itemTotal
      })
    }

    const shipping = deliveryMethod === 'pickup' ? 0 : 50
    const tax = 0
    const total = subtotal + shipping + tax

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
      notes,
      paymentStatus: 'pending',
      orderStatus: 'pending'
    })

    res.status(201).json({
      success: true,
      data: {
        order,
        payableAmount: order.total,
        currency: 'KES'
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

