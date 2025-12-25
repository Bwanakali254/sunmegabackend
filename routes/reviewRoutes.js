const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')
const {
  getProductReviews,
  createReview,
  updateReview,
  deleteReview
} = require('../controllers/reviewController')

// Public routes
router.get('/products/:productId', getProductReviews)

// Protected routes
router.post('/', protect, validate(schemas.createReview), createReview)
router.put('/:id', protect, validate(schemas.updateReview), updateReview)
router.delete('/:id', protect, deleteReview)

module.exports = router

