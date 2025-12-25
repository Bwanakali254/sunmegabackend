const User = require('../models/User')
const Product = require('../models/Product')
const Order = require('../models/Order')
const Review = require('../models/Review')
const Contact = require('../models/Contact')
const Quote = require('../models/Quote')
const Newsletter = require('../models/Newsletter')
const logger = require('../utils/logger')

/**
 * @desc    Get admin dashboard stats
 * @route   GET /api/admin/dashboard
 * @access  Private/Admin
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      pendingOrders,
      recentOrders,
      lowStockProducts
    ] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Product.countDocuments(),
      Order.countDocuments(),
      Order.aggregate([
        { $match: { paymentStatus: 'paid' } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]),
      Order.countDocuments({ orderStatus: 'pending' }),
      Order.find()
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .limit(10)
        .select('orderNumber total orderStatus paymentStatus createdAt'),
      Product.find({ stock: { $lte: 10 }, active: true })
        .select('name stock')
        .limit(10)
    ])

    const revenue = totalRevenue[0]?.total || 0

    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalProducts,
          totalOrders,
          totalRevenue: revenue,
          pendingOrders
        },
        recentOrders,
        lowStockProducts
      }
    })
  } catch (error) {
    logger.error('Get dashboard stats error:', error)
    next(error)
  }
}

/**
 * @desc    Get all users with pagination
 * @route   GET /api/admin/users
 * @access  Private/Admin
 */
const getUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const search = req.query.search || ''
    const role = req.query.role || ''

    const query = {}
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ]
    }
    if (role) {
      query.role = role
    }

    const skip = (page - 1) * limit

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password -emailVerificationToken -passwordResetToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(query)
    ])

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    logger.error('Get users error:', error)
    next(error)
  }
}

/**
 * @desc    Get single user
 * @route   GET /api/admin/users/:id
 * @access  Private/Admin
 */
const getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -emailVerificationToken -passwordResetToken')

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    res.json({
      success: true,
      data: { user }
    })
  } catch (error) {
    logger.error('Get user error:', error)
    next(error)
  }
}

/**
 * @desc    Update user role or status
 * @route   PUT /api/admin/users/:id
 * @access  Private/Admin
 */
const updateUser = async (req, res, next) => {
  try {
    const { role, emailVerified } = req.body

    const updateData = {}
    if (role && ['user', 'admin'].includes(role)) {
      updateData.role = role
    }
    if (typeof emailVerified === 'boolean') {
      updateData.emailVerified = emailVerified
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -passwordResetToken')

    if (!user) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    res.json({
      success: true,
      data: { user }
    })
  } catch (error) {
    logger.error('Update user error:', error)
    next(error)
  }
}

/**
 * @desc    Get all orders with filters
 * @route   GET /api/admin/orders
 * @access  Private/Admin
 */
const getOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const orderStatus = req.query.orderStatus || ''
    const paymentStatus = req.query.paymentStatus || ''
    const search = req.query.search || ''

    const query = {}
    if (orderStatus) query.orderStatus = orderStatus
    if (paymentStatus) query.paymentStatus = paymentStatus
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'shippingAddress.email': { $regex: search, $options: 'i' } }
      ]
    }

    const skip = (page - 1) * limit

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ])

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    logger.error('Get orders error:', error)
    next(error)
  }
}

/**
 * @desc    Update order status (admin only)
 * @route   PUT /api/admin/orders/:id/status
 * @access  Private/Admin
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { orderStatus, trackingNumber } = req.body

    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Order not found',
          code: 'ORDER_NOT_FOUND'
        }
      })
    }

    const updateData = {}
    if (orderStatus) {
      updateData.orderStatus = orderStatus
    }
    if (trackingNumber) {
      updateData.trackingNumber = trackingNumber
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('userId', 'firstName lastName email')

    res.json({
      success: true,
      data: { order: updatedOrder }
    })
  } catch (error) {
    logger.error('Update order status error:', error)
    next(error)
  }
}

/**
 * @desc    Get all products with filters
 * @route   GET /api/admin/products
 * @access  Private/Admin
 */
const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const search = req.query.search || ''
    const category = req.query.category || ''
    const active = req.query.active

    const query = {}
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }
    if (category) query.category = category
    if (typeof active === 'string') {
      query.active = active === 'true'
    }

    const skip = (page - 1) * limit

    const [products, total] = await Promise.all([
      Product.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Product.countDocuments(query)
    ])

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    })
  } catch (error) {
    logger.error('Get products error:', error)
    next(error)
  }
}

/**
 * @desc    Get all reviews with filters
 * @route   GET /api/admin/reviews
 * @access  Private/Admin
 */
const getReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1
    const limit = parseInt(req.query.limit) || 20
    const status = req.query.status || ''

    const query = {}
    if (status) query.status = status

    const skip = (page - 1) * limit

    const [reviews, total] = await Promise.all([
      Review.find(query)
        .populate('productId', 'name')
        .populate('userId', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments(query)
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
    logger.error('Get reviews error:', error)
    next(error)
  }
}

/**
 * @desc    Update review status
 * @route   PUT /api/admin/reviews/:id/status
 * @access  Private/Admin
 */
const updateReviewStatus = async (req, res, next) => {
  try {
    const { status } = req.body

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid status',
          code: 'INVALID_STATUS'
        }
      })
    }

    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    )
      .populate('productId', 'name')
      .populate('userId', 'firstName lastName email')

    if (!review) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Review not found',
          code: 'REVIEW_NOT_FOUND'
        }
      })
    }

    // Update product rating if review is approved/rejected
    if (status === 'approved' || status === 'rejected') {
      await updateProductRating(review.productId)
    }

    res.json({
      success: true,
      data: { review }
    })
  } catch (error) {
    logger.error('Update review status error:', error)
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
  getDashboardStats,
  getUsers,
  getUser,
  updateUser,
  getOrders,
  updateOrderStatus,
  getProducts,
  getReviews,
  updateReviewStatus
}

