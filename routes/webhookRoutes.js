const express = require('express')
const router = express.Router()
const { handlePayPalWebhook } = require('../controllers/webhookController')

// Webhook routes (public, but verified by signature)
router.post('/paypal', handlePayPalWebhook)

module.exports = router
