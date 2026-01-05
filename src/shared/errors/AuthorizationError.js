const BaseError = require('./BaseError')

/**
 * AUTHORIZATION ERROR
 * 
 * Thrown when user lacks required permissions (403 Forbidden)
 */

class AuthorizationError extends BaseError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR', true)
  }
}

module.exports = AuthorizationError
