const express = require('express')
const router = express.Router()
const passport = require('../config/passport')
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
const { handleOAuthCallback, initiateOAuth } = require('../controllers/oauthController')

// Public routes
router.post('/register', authLimiter, validate(schemas.register), register)
router.post('/login', authLimiter, validate(schemas.login), login)
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), forgotPassword)
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), resetPassword)
router.get('/verify-email/:token', verifyEmail)
router.post('/refresh-token', refreshToken)

// OAuth routes (with rate limiting)
router.get('/oauth/google', authLimiter, passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get('/oauth/google/callback', authLimiter, passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_failed` }), handleOAuthCallback)
router.get('/oauth/facebook', authLimiter, passport.authenticate('facebook', { scope: ['email'] }))
router.get('/oauth/facebook/callback', authLimiter, passport.authenticate('facebook', { session: false, failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=oauth_failed` }), handleOAuthCallback)

// Protected routes
router.post('/logout', protect, logout)
router.get('/me', protect, getMe)
router.put('/update-profile', protect, validate(schemas.updateProfile), updateProfile)
router.put('/change-password', protect, validate(schemas.changePassword), changePassword)

module.exports = router

