const express = require('express')
const router = express.Router()
const { formLimiter } = require('../middleware/rateLimiter')
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { validate, schemas } = require('../middleware/validate')
const {
  submitQuote,
  getQuotes,
  updateQuoteStatus
} = require('../controllers/quoteController')

// Public routes
router.post('/', formLimiter, validate(schemas.submitQuote), submitQuote)

// Protected routes (Admin only)
router.get('/', protect, authorize('admin'), getQuotes)
router.put('/:id/status', protect, authorize('admin'), validate(schemas.updateQuoteStatus), updateQuoteStatus)

module.exports = router

