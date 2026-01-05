const Cart = require('../models/Cart')
const Product = require('../models/Product')
const logger = require('../utils/logger')

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private
 */
const getCart = async (req, res, next) => {
  try {
    let cart = await Cart.findOne({ userId: req.user.id })
      .populate('items.productId', 'name price images category stock active')

    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] })
    }

    /**
     * CART INTEGRITY: Filter out invalid cart items
     * 
     * Removes items where:
     * 1. productId is null (product was deleted from database)
     * 2. productId.active is false (product was deactivated)
     * 
     * This prevents:
     * - Order creation failures due to null product references
     * - Frontend errors when rendering cart items
     * - Cart corruption from deleted products
     */
    const validItems = cart.items.filter(item => {
      // CRITICAL: Check if productId exists (not null) - handles deleted products
      if (!item.productId) {
        logger.warn(`Cart item ${item._id} has null productId - product was deleted. Removing from cart.`)
        return false
      }
      
      // Check if product is active - handles deactivated products
      if (item.productId.active === false) {
        logger.info(`Cart item ${item._id} references inactive product ${item.productId._id}. Removing from cart.`)
        return false
      }
      
      return true
    })

    // Update cart if items were filtered (sanitize cart integrity)
    if (validItems.length !== cart.items.length) {
      const removedCount = cart.items.length - validItems.length
      logger.info(`Cart sanitized: Removed ${removedCount} invalid item(s) from cart for user ${req.user.id}`)
      cart.items = validItems
      await cart.save()
    }

    const total = cart.calculateTotal()

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Add item to cart
 * @route   POST /api/cart
 * @access  Private
 */
const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body

    // Validate product exists and is active
    const product = await Product.findById(productId)
    if (!product || !product.active) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found or unavailable',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    // Check stock availability
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Only ${product.stock} items available in stock`,
          code: 'INSUFFICIENT_STOCK'
        }
      })
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      cart = await Cart.create({ userId: req.user.id, items: [] })
    }

    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId.toString() === productId
    )

    if (existingItemIndex > -1) {
      // Update quantity
      const newQuantity = cart.items[existingItemIndex].quantity + quantity
      
      // Check stock for new total quantity
      if (product.stock < newQuantity) {
        return res.status(400).json({
          success: false,
          error: {
            message: `Only ${product.stock} items available in stock`,
            code: 'INSUFFICIENT_STOCK'
          }
        })
      }

      cart.items[existingItemIndex].quantity = newQuantity
      cart.items[existingItemIndex].price = product.price // Update price in case it changed
    } else {
      // Add new item
      cart.items.push({
        productId,
        quantity,
        price: product.price
      })
    }

    await cart.save()

    const total = cart.calculateTotal()

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        },
        message: 'Item added to cart'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update cart item quantity
 * @route   PUT /api/cart/:itemId
 * @access  Private
 */
const updateCartItem = async (req, res, next) => {
  try {
    const { itemId } = req.params
    const { quantity } = req.body

    if (!quantity || quantity < 1) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Quantity must be at least 1',
          code: 'INVALID_QUANTITY'
        }
      })
    }

    const cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Cart not found',
          code: 'CART_NOT_FOUND'
        }
      })
    }

    const item = cart.items.id(itemId)
    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Cart item not found',
          code: 'ITEM_NOT_FOUND'
        }
      })
    }

    // Check stock availability
    const product = await Product.findById(item.productId)
    if (!product || !product.active) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found or unavailable',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Only ${product.stock} items available in stock`,
          code: 'INSUFFICIENT_STOCK'
        }
      })
    }

    item.quantity = quantity
    item.price = product.price // Update price in case it changed
    await cart.save()

    const total = cart.calculateTotal()

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        },
        message: 'Cart updated'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/:itemId
 * @access  Private
 */
const removeFromCart = async (req, res, next) => {
  try {
    const { itemId } = req.params

    const cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Cart not found',
          code: 'CART_NOT_FOUND'
        }
      })
    }

    const item = cart.items.id(itemId)
    if (!item) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Cart item not found',
          code: 'ITEM_NOT_FOUND'
        }
      })
    }

    cart.items.pull(itemId)
    await cart.save()

    const total = cart.calculateTotal()

    res.json({
      success: true,
      data: {
        cart: {
          items: cart.items,
          total,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0)
        },
        message: 'Item removed from cart'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart
 * @access  Private
 */
const clearCart = async (req, res, next) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id })
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Cart not found',
          code: 'CART_NOT_FOUND'
        }
      })
    }

    cart.items = []
    await cart.save()

    res.json({
      success: true,
      message: 'Cart cleared'
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
}

