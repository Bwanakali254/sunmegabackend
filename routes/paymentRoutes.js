const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')
const {
  initiatePayment,
  pesapalCallback,
  pesapalIPN,
  checkPaymentStatus
} = require('../controllers/paymentController')

// Public routes (for Pesapal callbacks)
router.get('/pesapal/callback', pesapalCallback)
router.post('/pesapal/ipn', pesapalIPN)

// Protected routes
router.post('/initiate', protect, validate(schemas.initiatePayment), initiatePayment)
router.get('/status/:orderId', protect, checkPaymentStatus)

module.exports = router

