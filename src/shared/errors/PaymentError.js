const BaseError = require('./BaseError')

/**
 * PAYMENT ERROR
 * 
 * Thrown when payment operation fails (402 Payment Required)
 */

class PaymentError extends BaseError {
  constructor(message = 'Payment failed', details = null) {
    super(message, 402, 'PAYMENT_ERROR', true)
    this.details = details // Optional: payment error details
  }
}

module.exports = PaymentError
