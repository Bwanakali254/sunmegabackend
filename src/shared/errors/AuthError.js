const BaseError = require('./BaseError')

/**
 * AUTHENTICATION ERROR
 * 
 * Thrown when authentication fails (401 Unauthorized)
 */

class AuthError extends BaseError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTH_ERROR', true)
  }
}

module.exports = AuthError
