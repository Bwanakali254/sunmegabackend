const BaseError = require('./BaseError')

/**
 * CONFLICT ERROR
 * 
 * Thrown when resource conflict occurs (409 Conflict)
 * Examples: Version mismatch, duplicate resource
 */

class ConflictError extends BaseError {
  constructor(message = 'Resource conflict', details = null) {
    super(message, 409, 'CONFLICT_ERROR', true)
    this.details = details // Optional: conflict details
  }
}

module.exports = ConflictError
