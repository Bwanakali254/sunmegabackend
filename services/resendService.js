const { Resend } = require('resend')
const logger = require('../utils/logger')

// Initialize Resend client
const resendApiKey = process.env.RESEND_API_KEY

if (!resendApiKey) {
  logger.warn('RESEND_API_KEY not configured - email sending will fail')
}

const resend = resendApiKey ? new Resend(resendApiKey) : null

/**
 * Send email via Resend API
 * Pure provider function - no routing logic, no business logic
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.from - Sender email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @returns {Promise<Object>} { success: boolean, messageId?: string, error?: string }
 * @throws {Error} If Resend API key is not configured or send fails
 */
const sendEmail = async ({ to, from, subject, html }) => {
  if (!resend) {
    throw new Error('Resend API key not configured')
  }

  if (!to || !from || !subject || !html) {
    throw new Error('Missing required email parameters: to, from, subject, html')
  }

  try {
    const result = await resend.emails.send({
      from,
      to,
      subject,
      html
    })

    if (result.error) {
      throw new Error(result.error.message || 'Resend API error')
    }

    return {
      success: true,
      messageId: result.data?.id
    }
  } catch (error) {
    logger.error('Resend API error:', error)
    throw error
  }
}

module.exports = {
  sendEmail
}
