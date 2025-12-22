const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { validate, schemas } = require('../middleware/validate')
const {
  subscribe,
  unsubscribe,
  getSubscribers
} = require('../controllers/newsletterController')

// Public routes
router.post('/subscribe', validate(schemas.subscribeNewsletter), subscribe)
router.post('/unsubscribe', validate(schemas.unsubscribeNewsletter), unsubscribe)

// Protected routes (Admin only)
router.get('/', protect, authorize('admin'), getSubscribers)

module.exports = router

