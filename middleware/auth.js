const jwt = require('jsonwebtoken')
const User = require('../models/User')
const logger = require('../utils/logger')

// Protect routes - require authentication
const protect = async (req, res, next) => {
  let token

  // Check for token in cookies first, then in Authorization header
  if (req.cookies.token) {
    token = req.cookies.token
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        message: 'Not authorized to access this route',
        code: 'UNAUTHORIZED'
      }
    })
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    // Get user from token
    req.user = await User.findById(decoded.id).select('-password')

    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    next()
  } catch (error) {
    logger.error('Auth middleware error:', error)
    return res.status(401).json({
      success: false,
      error: {
        message: 'Not authorized to access this route',
        code: 'UNAUTHORIZED'
      }
    })
  }
}

module.exports = { protect }

