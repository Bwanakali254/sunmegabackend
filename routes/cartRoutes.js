const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')
const {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  clearCart
} = require('../controllers/cartController')

// All cart routes require authentication
router.use(protect)

router.get('/', getCart)
router.post('/', validate(schemas.addToCart), addToCart)
router.put('/:itemId', validate(schemas.updateCartItem), updateCartItem)
router.delete('/:itemId', removeFromCart)
router.delete('/', clearCart)

module.exports = router

