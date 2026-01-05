const BaseError = require('./BaseError')

/**
 * NOT FOUND ERROR
 * 
 * Thrown when resource is not found (404 Not Found)
 */

class NotFoundError extends BaseError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND', true)
  }
}

module.exports = NotFoundError
