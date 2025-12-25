const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const {
  getDashboardStats,
  getUsers,
  getUser,
  updateUser,
  getOrders,
  updateOrderStatus,
  getProducts,
  getReviews,
  updateReviewStatus
} = require('../controllers/adminController')

// All admin routes require authentication and admin role
router.use(protect)
router.use(authorize('admin'))

// Dashboard
router.get('/dashboard', getDashboardStats)

// Users
router.get('/users', getUsers)
router.get('/users/:id', getUser)
router.put('/users/:id', updateUser)

// Orders
router.get('/orders', getOrders)
router.put('/orders/:id/status', updateOrderStatus)

// Products
router.get('/products', getProducts)

// Reviews
router.get('/reviews', getReviews)
router.put('/reviews/:id/status', updateReviewStatus)

module.exports = router

