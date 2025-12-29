const logger = require('../utils/logger')

const mongoose = require('mongoose')

const errorHandler = (err, req, res, _next) => {
  let error = { ...err }
  error.message = err.message

  // Log error
  logger.error('Error:', err)

  // Mongoose connection errors
  if (err.name === 'MongooseError' || err.name === 'MongoServerError') {
    // Check if MongoDB is disconnected
    if (mongoose.connection.readyState === 0) {
      return res.status(503).json({
        success: false,
        error: {
          message: 'Database connection unavailable. Please try again later.',
          code: 'DATABASE_UNAVAILABLE'
        }
      })
    }
  }

  // Mongoose buffering timeout (connection not ready)
  if (err.message && err.message.includes('buffering timed out')) {
    return res.status(503).json({
      success: false,
      error: {
        message: 'Database connection timeout. Please check your connection and try again.',
        code: 'DATABASE_TIMEOUT'
      }
    })
  }

  // DNS/Network timeout errors (MongoDB Atlas connection issues)
  if (err.message && (err.message.includes('ETIMEOUT') || err.message.includes('queryTxt') || err.message.includes('ENOTFOUND'))) {
    return res.status(503).json({
      success: false,
      error: {
        message: 'Database connection unavailable. Please check your network connection and MongoDB Atlas configuration.',
        code: 'DATABASE_UNAVAILABLE'
      }
    })
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found'
    error = { message, statusCode: 404 }
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered'
    error = { message, statusCode: 400 }
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ')
    error = { message, statusCode: 400 }
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token'
    error = { message, statusCode: 401 }
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired'
    error = { message, statusCode: 401 }
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: {
      message: error.message || 'Server Error',
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  })
}

module.exports = errorHandler

