const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { validate, schemas } = require('../middleware/validate')
const {
  createOrder,
  getOrders,
  getOrder,
  updateOrderStatus,
  updatePaymentStatus,
  cancelOrder
} = require('../controllers/orderController')

// All order routes require authentication
router.use(protect)

router.post('/', validate(schemas.createOrder), createOrder)
router.get('/', getOrders)
router.get('/:id', getOrder)
router.put('/:id/status', authorize('admin'), validate(schemas.updateOrderStatus), updateOrderStatus)
router.put('/:id/payment', validate(schemas.updatePaymentStatus), updatePaymentStatus)
router.put('/:id/cancel', cancelOrder)

module.exports = router

