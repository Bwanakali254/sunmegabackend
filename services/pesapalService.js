const axios = require('axios')
const crypto = require('crypto')
const logger = require('../utils/logger')

/**
 * Pesapal Service
 * Handles all Pesapal API interactions
 */

const PESAPAL_BASE_URL = process.env.PESAPAL_ENVIRONMENT === 'production'
  ? 'https://pay.pesapal.com/v3'
  : 'https://cybqa.pesapal.com/pesapalv3'

const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET
// Construct callback URL from BACKEND_URL if PESAPAL_CALLBACK_URL not set
const CALLBACK_URL = process.env.PESAPAL_CALLBACK_URL || (process.env.BACKEND_URL ? `${process.env.BACKEND_URL}/api/payments/pesapal/callback` : null)

if (!CALLBACK_URL) {
  throw new Error('PESAPAL_CALLBACK_URL or BACKEND_URL must be set')
}

let accessToken = null
let tokenExpiry = null

/**
 * Get Pesapal access token
 */
const getAccessToken = async () => {
  try {
    // Check if token is still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken
    }

    const response = await axios.post(
      `${PESAPAL_BASE_URL}/api/Auth/RequestToken`,
      {
        consumer_key: CONSUMER_KEY,
        consumer_secret: CONSUMER_SECRET
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )

    if (response.data && response.data.token) {
      accessToken = response.data.token
      // Token expires in 3600 seconds (1 hour), refresh 5 minutes before
      tokenExpiry = Date.now() + (3600 - 300) * 1000
      return accessToken
    }

    throw new Error('Failed to get access token')
  } catch (error) {
    logger.error('Pesapal getAccessToken error:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Submit payment order to Pesapal
 * @param {Object} orderData - Order data
 * @returns {Object} Payment response with redirect URL
 */
const submitOrder = async (orderData) => {
  try {
    const token = await getAccessToken()

    const {
      orderId,
      amount,
      currency = 'KES',
      description,
      customerEmail,
      customerPhone,
      customerName,
      reference
    } = orderData

    const payload = {
      id: reference || orderId,
      currency: currency,
      amount: amount,
      description: description,
      callback_url: CALLBACK_URL,
      redirect_mode: 'PARENT_WINDOW',
      notification_id: reference || orderId,
      billing_address: {
        email_address: customerEmail,
        phone_number: customerPhone,
        country_code: 'KE',
        first_name: customerName.split(' ')[0] || customerName,
        middle_name: '',
        last_name: customerName.split(' ').slice(1).join(' ') || '',
        line_1: '',
        line_2: '',
        city: '',
        state: '',
        postal_code: '',
        zip_code: ''
      }
    }

    const response = await axios.post(
      `${PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )

    if (response.data && response.data.redirect_url) {
      return {
        success: true,
        orderTrackingId: response.data.order_tracking_id,
        redirectUrl: response.data.redirect_url,
        merchantReference: response.data.merchant_reference
      }
    }

    throw new Error('Failed to submit order to Pesapal')
  } catch (error) {
    logger.error('Pesapal submitOrder error:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Get payment status from Pesapal
 * @param {String} orderTrackingId - Pesapal order tracking ID
 * @returns {Object} Payment status
 */
const getPaymentStatus = async (orderTrackingId) => {
  try {
    const token = await getAccessToken()

    const response = await axios.get(
      `${PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    )

    if (response.data) {
      return {
        success: true,
        paymentStatus: response.data.payment_status_description,
        paymentMethod: response.data.payment_method,
        amount: response.data.amount,
        currency: response.data.currency_code,
        merchantReference: response.data.merchant_reference,
        orderTrackingId: response.data.order_tracking_id
      }
    }

    throw new Error('Failed to get payment status')
  } catch (error) {
    logger.error('Pesapal getPaymentStatus error:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Verify IPN (Instant Payment Notification)
 * @param {String} orderTrackingId - Pesapal order tracking ID
 * @param {String} orderMerchantReference - Merchant reference
 * @returns {Object} IPN verification result
 */
const verifyIPN = async (orderTrackingId, orderMerchantReference) => {
  try {
    const token = await getAccessToken()

    const response = await axios.get(
      `${PESAPAL_BASE_URL}/api/Transactions/ConfirmTransaction?orderTrackingId=${orderTrackingId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      }
    )

    if (response.data) {
      return {
        success: true,
        paymentStatus: response.data.payment_status_description,
        paymentMethod: response.data.payment_method,
        amount: response.data.amount,
        currency: response.data.currency_code,
        merchantReference: response.data.merchant_reference,
        orderTrackingId: response.data.order_tracking_id
      }
    }

    throw new Error('Failed to verify IPN')
  } catch (error) {
    logger.error('Pesapal verifyIPN error:', error.response?.data || error.message)
    throw error
  }
}

module.exports = {
  submitOrder,
  getPaymentStatus,
  verifyIPN,
  getAccessToken
}

