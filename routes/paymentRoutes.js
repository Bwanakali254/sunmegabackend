const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')
const {
  initiatePayment,
  pesapalCallback,
  pesapalIPN,
  checkPaymentStatus,
  createPayPalOrder
} = require('../controllers/paymentController')

// Public routes (for Pesapal callbacks)
router.get('/pesapal/callback', pesapalCallback)
router.post('/pesapal/ipn', pesapalIPN)

// Protected routes
router.post('/initiate', protect, validate(schemas.initiatePayment), initiatePayment)
router.post('/paypal/create', protect, validate(schemas.createPayPalOrder), createPayPalOrder)
router.get('/status/:orderId', protect, checkPaymentStatus)

module.exports = router

