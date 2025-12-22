const express = require('express')
const router = express.Router()
const { authLimiter } = require('../middleware/rateLimiter')
const { protect } = require('../middleware/auth')
const { validate, schemas } = require('../middleware/validate')
const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  updateProfile,
  changePassword,
  refreshToken
} = require('../controllers/authController')

// Public routes
router.post('/register', authLimiter, validate(schemas.register), register)
router.post('/login', authLimiter, validate(schemas.login), login)
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), forgotPassword)
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), resetPassword)
router.get('/verify-email/:token', verifyEmail)
router.post('/refresh-token', refreshToken)

// Protected routes
router.post('/logout', protect, logout)
router.get('/me', protect, getMe)
router.put('/update-profile', protect, validate(schemas.updateProfile), updateProfile)
router.put('/change-password', protect, validate(schemas.changePassword), changePassword)

module.exports = router

