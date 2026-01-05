/**
 * ERROR EXPORTS
 * 
 * Central export point for all error classes
 */

module.exports = {
  BaseError: require('./BaseError'),
  ValidationError: require('./ValidationError'),
  AuthError: require('./AuthError'),
  AuthorizationError: require('./AuthorizationError'),
  NotFoundError: require('./NotFoundError'),
  ConflictError: require('./ConflictError'),
  PaymentError: require('./PaymentError')
}
