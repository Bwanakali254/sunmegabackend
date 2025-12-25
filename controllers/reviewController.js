const Review = require('../models/Review')
const Product = require('../models/Product')
const Order = require('../models/Order')
const logger = require('../utils/logger')

/**
 * @desc    Get reviews for a product
 * @route   GET /api/products/:productId/reviews
 * @access  Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 10

    const skip = (page - 1) * limit

    const [reviews, total] = await Promise.all([
      Review.find({
        productId,
        status: 'approved'
      })
        .populate('userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({
        productId,
        status: 'approved'
      })
    ])

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    logger.error('Get product reviews error:', error)
    next(error)
  }
}

/**
 * @desc    Create a review
 * @route   POST /api/reviews
 * @access  Private
 */
const createReview = async (req, res, next) => {
  try {
    const { productId, rating, title, comment } = req.body
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

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({ productId, userId })
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'You have already reviewed this product',
          code: 'REVIEW_EXISTS'
        }
      })
    }

    // Check if user purchased the product (for verified badge)
    const hasPurchased = await Order.findOne({
      userId,
      'items.productId': productId,
      paymentStatus: 'paid'
    })

    // Create review
    const review = await Review.create({
      productId,
      userId,
      rating,
      title: title || '',
      comment: comment || '',
      verified: !!hasPurchased,
      status: 'pending' // Admin must approve
    })

    // Update product rating (will be recalculated when approved)
    await updateProductRating(productId)

    res.status(201).json({
      success: true,
      data: { review },
      message: 'Review submitted successfully. It will be visible after approval.'
    })
  } catch (error) {
    logger.error('Create review error:', error)
    next(error)
  }
}

/**
 * @desc    Update own review
 * @route   PUT /api/reviews/:id
 * @access  Private
 */
const updateReview = async (req, res, next) => {
  try {
    const { rating, title, comment } = req.body
    const userId = req.user.id

    const review = await Review.findById(req.params.id)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Review not found',
          code: 'REVIEW_NOT_FOUND'
        }
      })
    }

    // Check ownership
    if (review.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Not authorized to update this review',
          code: 'FORBIDDEN'
        }
      })
    }

    // Update review
    if (rating) review.rating = rating
    if (title !== undefined) review.title = title
    if (comment !== undefined) review.comment = comment
    review.status = 'pending' // Reset to pending after update

    await review.save()

    // Update product rating
    await updateProductRating(review.productId)

    res.json({
      success: true,
      data: { review },
      message: 'Review updated successfully. It will be visible after approval.'
    })
  } catch (error) {
    logger.error('Update review error:', error)
    next(error)
  }
}

/**
 * @desc    Delete own review
 * @route   DELETE /api/reviews/:id
 * @access  Private
 */
const deleteReview = async (req, res, next) => {
  try {
    const userId = req.user.id

    const review = await Review.findById(req.params.id)

    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Review not found',
          code: 'REVIEW_NOT_FOUND'
        }
      })
    }

    // Check ownership
    if (review.userId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Not authorized to delete this review',
          code: 'FORBIDDEN'
        }
      })
    }

    const productId = review.productId
    await review.deleteOne()

    // Update product rating
    await updateProductRating(productId)

    res.json({
      success: true,
      message: 'Review deleted successfully'
    })
  } catch (error) {
    logger.error('Delete review error:', error)
    next(error)
  }
}

/**
 * Helper function to update product rating
 */
const updateProductRating = async (productId) => {
  try {
    const reviews = await Review.find({
      productId,
      status: 'approved'
    })

    if (reviews.length === 0) {
      await Product.findByIdAndUpdate(productId, {
        rating: 0,
        reviewCount: 0
      })
      return
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const averageRating = totalRating / reviews.length

    await Product.findByIdAndUpdate(productId, {
      rating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      reviewCount: reviews.length
    })
  } catch (error) {
    logger.error('Update product rating error:', error)
  }
}

module.exports = {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview
}

