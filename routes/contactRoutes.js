const express = require('express')
const router = express.Router()
const { formLimiter } = require('../middleware/rateLimiter')
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { validate, schemas } = require('../middleware/validate')
const {
  submitContact,
  getContacts,
  updateContactStatus
} = require('../controllers/contactController')

// Public routes
router.post('/', formLimiter, validate(schemas.submitContact), submitContact)

// Protected routes (Admin only)
router.get('/', protect, authorize('admin'), getContacts)
router.put('/:id/status', protect, authorize('admin'), validate(schemas.updateContactStatus), updateContactStatus)

module.exports = router

