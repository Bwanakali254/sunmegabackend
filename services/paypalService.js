const axios = require('axios')
const crypto = require('crypto')
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

/**
 * Capture PayPal payment
 * @param {String} paypalOrderId - PayPal order ID to capture
 * @returns {Object} Capture response with status and payment details
 */
const captureOrder = async (paypalOrderId) => {
  try {
    const token = await getAccessToken()

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${paypalOrderId}/capture`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    )

    if (response.data && response.data.id) {
      const capture = response.data
      const purchaseUnit = capture.purchase_units?.[0]
      const captureDetails = purchaseUnit?.payments?.captures?.[0]

      return {
        success: true,
        status: capture.status,
        paypalOrderId: capture.id,
        captureId: captureDetails?.id,
        amount: captureDetails?.amount?.value ? parseFloat(captureDetails.amount.value) : null,
        currency: captureDetails?.amount?.currency_code || null,
        payerEmail: capture.payer?.email_address || null,
        payerName: capture.payer?.name?.given_name && capture.payer?.name?.surname
          ? `${capture.payer.name.given_name} ${capture.payer.name.surname}`
          : null
      }
    }

    throw new Error('Failed to capture PayPal order')
  } catch (error) {
    logger.error('PayPal captureOrder error:', error.response?.data || error.message)
    throw error
  }
}

/**
 * Verify PayPal webhook signature
 * @param {Object} headers - Request headers
 * @param {String} rawBody - Raw request body (JSON string)
 * @param {String} webhookId - PayPal webhook ID from environment
 * @returns {Boolean} True if signature is valid
 */
const verifyWebhookSignature = async (headers, rawBody, webhookId) => {
  try {
    const token = await getAccessToken()

    // PayPal webhook verification requires the raw body as JSON object
    let webhookEvent
    try {
      webhookEvent = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody
    } catch (parseError) {
      logger.error('Failed to parse webhook body:', parseError)
      return false
    }

    // Extract signature headers (PayPal uses lowercase headers)
    const authAlgo = headers['paypal-auth-algo'] || headers['Paypal-Auth-Algo']
    const certUrl = headers['paypal-cert-url'] || headers['Paypal-Cert-Url']
    const transmissionId = headers['paypal-transmission-id'] || headers['Paypal-Transmission-Id']
    const transmissionSig = headers['paypal-transmission-sig'] || headers['Paypal-Transmission-Sig']
    const transmissionTime = headers['paypal-transmission-time'] || headers['Paypal-Transmission-Time']

    if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
      logger.warn('Missing PayPal webhook signature headers:', {
        hasAuthAlgo: !!authAlgo,
        hasCertUrl: !!certUrl,
        hasTransmissionId: !!transmissionId,
        hasTransmissionSig: !!transmissionSig,
        hasTransmissionTime: !!transmissionTime
      })
      return false
    }

    // Verify webhook signature with PayPal
    const verificationPayload = {
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent
    }

    const response = await axios.post(
      `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
      verificationPayload,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data && response.data.verification_status === 'SUCCESS') {
      return true
    }

    logger.warn('PayPal webhook signature verification failed:', response.data)
    return false
  } catch (error) {
    logger.error('PayPal webhook verification error:', error.response?.data || error.message)
    return false
  }
}

module.exports = {
  createOrder,
  captureOrder,
  verifyWebhookSignature,
  getAccessToken
}
