const BaseError = require('./BaseError')

/**
 * VALIDATION ERROR
 * 
 * Thrown when request validation fails (400 Bad Request)
 */

class ValidationError extends BaseError {
  constructor(message = 'Validation failed', errors = null) {
    super(message, 400, 'VALIDATION_ERROR', true)
    this.errors = errors // Optional: detailed validation errors
  }
}

module.exports = ValidationError
