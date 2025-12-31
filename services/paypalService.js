const axios = require('axios')
const logger = require('../utils/logger')

/**
 * PayPal Service
 * Handles all PayPal REST API interactions
 */

const PAYPAL_BASE_URL = process.env.PAYPAL_ENVIRONMENT === 'production'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com'

const CLIENT_ID = process.env.PAYPAL_CLIENT_ID
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET

if (!CLIENT_ID || !CLIENT_SECRET) {
  logger.warn('PayPal credentials not configured. PayPal payments will not work.')
}

let accessToken = null
let tokenExpiry = null

/**
 * Get PayPal access token
 */
const getAccessToken = async () => {
  try {
    // Check if token is still valid
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
      return accessToken
    }

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('PayPal credentials not configured')
    }

    const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    )

    if (response.data && response.data.access_token) {
      accessToken = response.data.access_token
      // Token expires in response.data.expires_in seconds, refresh 5 minutes before
      const expiresIn = response.data.expires_in || 32400 // Default 9 hours
      tokenExpiry = Date.now() + (expiresIn - 300) * 1000
      return accessToken
    }

    throw new Error('Failed to get PayPal access token')
  } catch (error) {
    logger.error('PayPal getAccessToken error:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Create PayPal order
 * @param {Object} orderData - Order data with amount, currency, orderId
 * @returns {Object} PayPal order response with order ID
 */
const createOrder = async (orderData) => {
  try {
    const token = await getAccessToken()

    const {
      amount,
      currency = 'USD',
      orderId,
      orderNumber
    } = orderData

    // PayPal order creation payload
    const payload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderNumber || orderId,
        description: `Order ${orderNumber || orderId}`,
        amount: {
          currency_code: currency,
          value: amount.toFixed(2)
        }
      }],
      application_context: {
        brand_name: 'Sun Mega Limited',
        landing_page: 'NO_PREFERENCE',
        user_action: 'PAY_NOW',
        return_url: `${process.env.FRONTEND_URL}/payment?status=success&orderId=${orderId}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment?status=cancelled&orderId=${orderId}`
      }
    }

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )

    if (response.data && response.data.id) {
      return {
        success: true,
        paypalOrderId: response.data.id,
        status: response.data.status,
        links: response.data.links
      }
    }

    throw new Error('Failed to create PayPal order')
  } catch (error) {
    logger.error('PayPal createOrder error:', error.response?.data || error.message)
    throw error
  }
}

module.exports = {
  createOrder,
  getAccessToken
}
