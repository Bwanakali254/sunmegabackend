const logger = require('../../utils/logger')
const mongoose = require('mongoose')
const { BaseError } = require('../errors')

/**
 * ENHANCED ERROR HANDLER
 * 
 * Handles all errors with proper categorization:
 * - Operational errors (expected) → User-friendly messages
 * - Programming errors (unexpected) → Generic message + stack in dev
 */

const errorHandler = (err, req, res, _next) => {
  // Use request ID if available
  const requestId = req.requestId || 'unknown'
  
  // If it's already a BaseError, use it directly
  if (err instanceof BaseError) {
    logger.error(`[${requestId}] ${err.name}: ${err.message}`, {
      code: err.code,
      statusCode: err.statusCode,
      ...(err.errors && { errors: err.errors }),
      ...(err.details && { details: err.details })
    })
    
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
        requestId,
        ...(err.errors && { errors: err.errors }),
        ...(err.details && { details: err.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      }
    })
  }
  
  // Handle Mongoose/MongoDB errors
  if (err.name === 'MongooseError' || err.name === 'MongoServerError') {
    if (mongoose.connection.readyState === 0) {
      logger.error(`[${requestId}] Database connection unavailable`)
      return res.status(503).json({
        success: false,
        error: {
          message: 'Database connection unavailable. Please try again later.',
          code: 'DATABASE_UNAVAILABLE',
          requestId
        }
      })
    }
  }
  
  // Mongoose buffering timeout
  if (err.message && err.message.includes('buffering timed out')) {
    logger.error(`[${requestId}] Database connection timeout`)
    return res.status(503).json({
      success: false,
      error: {
        message: 'Database connection timeout. Please check your connection and try again.',
        code: 'DATABASE_TIMEOUT',
        requestId
      }
    })
  }
  
  // DNS/Network timeout errors
  if (err.message && (err.message.includes('ETIMEOUT') || err.message.includes('queryTxt') || err.message.includes('ENOTFOUND'))) {
    logger.error(`[${requestId}] Database DNS/network error: ${err.message}`)
    return res.status(503).json({
      success: false,
      error: {
        message: 'Database connection unavailable. Please check your network connection and MongoDB Atlas configuration.',
        code: 'DATABASE_UNAVAILABLE',
        requestId
      }
    })
  }
  
  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    logger.error(`[${requestId}] Invalid ObjectId: ${err.message}`)
    return res.status(404).json({
      success: false,
      error: {
        message: 'Resource not found',
        code: 'NOT_FOUND',
        requestId
      }
    })
  }
  
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern || {})[0] || 'field'
    logger.error(`[${requestId}] Duplicate key violation: ${field}`)
    return res.status(409).json({
      success: false,
      error: {
        message: `Duplicate ${field} value`,
        code: 'DUPLICATE_KEY',
        requestId,
        field
      }
    })
  }
  
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(e => ({
      field: e.path,
      message: e.message
    }))
    logger.error(`[${requestId}] Validation error:`, errors)
    return res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        requestId,
        errors
      }
    })
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    logger.error(`[${requestId}] Invalid JWT token`)
    return res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 'INVALID_TOKEN',
        requestId
      }
    })
  }
  
  if (err.name === 'TokenExpiredError') {
    logger.error(`[${requestId}] Expired JWT token`)
    return res.status(401).json({
      success: false,
      error: {
        message: 'Token expired',
        code: 'TOKEN_EXPIRED',
        requestId
      }
    })
  }
  
  // Unknown error - log full details
  logger.error(`[${requestId}] Unexpected error:`, {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code
  })
  
  // Return generic error (don't leak implementation details)
  return res.status(500).json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
      code: 'INTERNAL_ERROR',
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  })
}

module.exports = errorHandler
