const Wishlist = require('../models/Wishlist')
const Product = require('../models/Product')
const logger = require('../utils/logger')

/**
 * @desc    Get user's wishlist
 * @route   GET /api/wishlist
 * @access  Private
 */
const getWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id

    let wishlist = await Wishlist.findOne({ userId })
      .populate('items.productId')

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, items: [] })
    }

    // Filter out deleted products
    wishlist.items = wishlist.items.filter(item => item.productId !== null)

    res.json({
      success: true,
      data: { wishlist }
    })
  } catch (error) {
    logger.error('Get wishlist error:', error)
    next(error)
  }
}

/**
 * @desc    Add product to wishlist
 * @route   POST /api/wishlist
 * @access  Private
 */
const addToWishlist = async (req, res, next) => {
  try {
    const { productId } = req.body
    const userId = req.user.id

    // Check if product exists
    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    // Get or create wishlist
    let wishlist = await Wishlist.findOne({ userId })

    if (!wishlist) {
      wishlist = await Wishlist.create({ userId, items: [] })
    }

    // Check if product already in wishlist
    const existingItem = wishlist.items.find(
      item => item.productId.toString() === productId
    )

    if (existingItem) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Product already in wishlist',
          code: 'ALREADY_IN_WISHLIST'
        }
      })
    }

    // Add product to wishlist
    wishlist.items.push({
      productId,
      addedAt: new Date()
    })

    await wishlist.save()
    await wishlist.populate('items.productId')

    res.status(201).json({
      success: true,
      data: { wishlist },
      message: 'Product added to wishlist'
    })
  } catch (error) {
    logger.error('Add to wishlist error:', error)
    next(error)
  }
}

/**
 * @desc    Remove product from wishlist
 * @route   DELETE /api/wishlist/:productId
 * @access  Private
 */
const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params
    const userId = req.user.id

    const wishlist = await Wishlist.findOne({ userId })

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Wishlist not found',
          code: 'WISHLIST_NOT_FOUND'
        }
      })
    }

    // Remove product from wishlist
    wishlist.items = wishlist.items.filter(
      item => item.productId.toString() !== productId
    )

    await wishlist.save()
    await wishlist.populate('items.productId')

    res.json({
      success: true,
      data: { wishlist },
      message: 'Product removed from wishlist'
    })
  } catch (error) {
    logger.error('Remove from wishlist error:', error)
    next(error)
  }
}

/**
 * @desc    Clear wishlist
 * @route   DELETE /api/wishlist
 * @access  Private
 */
const clearWishlist = async (req, res, next) => {
  try {
    const userId = req.user.id

    const wishlist = await Wishlist.findOne({ userId })

    if (!wishlist) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Wishlist not found',
          code: 'WISHLIST_NOT_FOUND'
        }
      })
    }

    wishlist.items = []
    await wishlist.save()

    res.json({
      success: true,
      data: { wishlist },
      message: 'Wishlist cleared'
    })
  } catch (error) {
    logger.error('Clear wishlist error:', error)
    next(error)
  }
}

module.exports = {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  clearWishlist
}

