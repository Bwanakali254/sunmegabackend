/**
 * BASE ERROR CLASS
 * 
 * All custom errors extend this class.
 * Provides consistent error structure for the application.
 */

class BaseError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isOperational = true) {
    super(message)
    
    this.statusCode = statusCode
    this.code = code
    this.isOperational = isOperational
    this.name = this.constructor.name
    
    Error.captureStackTrace(this, this.constructor)
  }
}

module.exports = BaseError
