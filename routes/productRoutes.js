const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { validate, schemas } = require('../middleware/validate')
const {
  getProducts,
  getProduct,
  getProductsByCategory,
  searchProducts,
  getFeaturedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductReviews
} = require('../controllers/productController')

// Public routes
router.get('/', getProducts)
router.get('/search', searchProducts)
router.get('/featured', getFeaturedProducts)
router.get('/category/:category', getProductsByCategory)
router.get('/:id', getProduct)
router.get('/:id/reviews', getProductReviews)

// Protected routes (Admin only)
router.post('/', protect, authorize('admin'), validate(schemas.createProduct), createProduct)
router.put('/:id', protect, authorize('admin'), validate(schemas.updateProduct), updateProduct)
router.delete('/:id', protect, authorize('admin'), deleteProduct)

module.exports = router

