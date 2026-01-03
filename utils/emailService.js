const { sendEmail: resendSendEmail } = require('../services/resendService')
const logger = require('./logger')

// Email routing configuration from environment variables
// Backend is the ONLY authority for routing
const EMAIL_ROUTING = {
  QUOTES: process.env.EMAIL_QUOTES,
  SUPPORT: process.env.EMAIL_SUPPORT,
  NEWS: process.env.EMAIL_NEWS,
  NO_REPLY: process.env.EMAIL_NO_REPLY || process.env.EMAIL_FROM
}

const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_ROUTING.NO_REPLY
const WEBSITE_URL = 'https://sunmega.co.ke'
const SUPPORT_EMAIL = 'support@sunmega.co.ke'

/**
 * Generate plain text version from HTML
 * @param {string} html - HTML content
 * @returns {string} Plain text version
 */
const htmlToPlainText = (html) => {
  return html
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim()
}

/**
 * Master email template generator
 * @param {Object} options - Template options
 * @param {string} options.title - Email title/heading
 * @param {string} options.content - Main content HTML
 * @param {string} options.complianceText - Compliance/reason text for footer
 * @returns {string} Complete HTML email
 */
const createEmailTemplate = ({ title, content, complianceText }) => {
  const currentYear = new Date().getFullYear()
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${title}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="background-color: #16a34a; padding: 30px 40px; text-align: center;">
              <a href="${WEBSITE_URL}" style="text-decoration: none; display: inline-block;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td style="color: #ffffff; font-size: 28px; font-weight: bold; letter-spacing: -0.5px;">
                      ☀️ SunMega Limited
                    </td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>
          
          <!-- Content Area -->
          <tr>
            <td style="padding: 40px; background-color: #ffffff;">
              <!-- Title -->
              <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 600; color: #111827; line-height: 1.3;">
                ${title}
              </h1>
              
              <!-- Main Content -->
              <div style="font-size: 16px; line-height: 1.6; color: #374151;">
                ${content}
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 32px 40px; border-top: 1px solid #e5e7eb;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 16px 0; font-size: 14px; color: #6b7280; line-height: 1.5;">
                      <strong style="color: #111827;">SunMega Limited</strong><br>
                      <a href="${WEBSITE_URL}" style="color: #16a34a; text-decoration: none;">${WEBSITE_URL}</a><br>
                      <a href="mailto:${SUPPORT_EMAIL}" style="color: #16a34a; text-decoration: none;">${SUPPORT_EMAIL}</a>
                    </p>
                    
                    ${complianceText ? `
                    <p style="margin: 0 0 16px 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                      ${complianceText}
                    </p>
                    ` : ''}
                    
                    <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                      © ${currentYear} SunMega Limited. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

/**
 * Internal: Send email via Resend (low-level wrapper)
 * Catches errors and logs them - never throws to controllers
 * 
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.from - Sender email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @returns {Promise<Object>} { success: boolean, messageId?: string }
 */
const _sendEmail = async ({ to, from, subject, html }) => {
  try {
    const result = await resendSendEmail({ to, from, subject, html })
    logger.info(`Email sent successfully to ${to}: ${result.messageId}`)
    return { success: true, messageId: result.messageId }
  } catch (error) {
    logger.error('Error sending email:', error)
    // Never throw - email failures don't break user flows
    return { success: false, error: error.message }
  }
}

/**
 * Send contact form notification
 * Routes to: support@sunmega.co.ke (EMAIL_SUPPORT)
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendContactNotification = async (contactData) => {
  const { name, email, phone, subject, message } = contactData

  if (!EMAIL_ROUTING.SUPPORT) {
    logger.warn('EMAIL_SUPPORT not configured, skipping contact notification email')
    return { success: false, skipped: true }
  }

  const content = `
    <p style="margin: 0 0 24px 0;">You have received a new contact form submission:</p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
      <tr>
        <td>
          <p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Name:</strong> <span style="color: #374151;">${name}</span></p>
          <p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Email:</strong> <a href="mailto:${email}" style="color: #16a34a; text-decoration: none;">${email}</a></p>
          ${phone ? `<p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Phone:</strong> <span style="color: #374151;">${phone}</span></p>` : ''}
          <p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Subject:</strong> <span style="color: #374151;">${subject}</span></p>
          <p style="margin: 0;"><strong style="color: #111827;">Message:</strong></p>
          <p style="margin: 12px 0 0 0; color: #374151; white-space: pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Please respond to this inquiry at your earliest convenience.</p>
  `

  const html = createEmailTemplate({
    title: 'New Contact Form Submission',
    content,
    complianceText: null
  })

  return _sendEmail({
    to: EMAIL_ROUTING.SUPPORT,
    from: EMAIL_FROM,
    subject: `New Contact Form: ${subject}`,
    html
  })
}

/**
 * Send quote request notification
 * Routes to: quotes@sunmega.co.ke (EMAIL_QUOTES)
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendQuoteNotification = async (quoteData) => {
  const { name, email, phone, location, systemSize, installationDate, contact, type } = quoteData

  if (!EMAIL_ROUTING.QUOTES) {
    logger.warn('EMAIL_QUOTES not configured, skipping quote notification email')
    return { success: false, skipped: true }
  }

  const content = `
    <p style="margin: 0 0 24px 0;">You have received a new quote request:</p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 24px;">
      <tr>
        <td>
          ${name ? `<p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Name:</strong> <span style="color: #374151;">${name}</span></p>` : ''}
          ${email ? `<p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Email:</strong> <a href="mailto:${email}" style="color: #16a34a; text-decoration: none;">${email}</a></p>` : ''}
          ${phone ? `<p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Phone:</strong> <span style="color: #374151;">${phone}</span></p>` : ''}
          <p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Location:</strong> <span style="color: #374151;">${location}</span></p>
          ${systemSize ? `<p style="margin: 0 0 12px 0;"><strong style="color: #111827;">System Size:</strong> <span style="color: #374151;">${systemSize}</span></p>` : ''}
          ${installationDate ? `<p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Preferred Installation Date:</strong> <span style="color: #374151;">${installationDate}</span></p>` : ''}
          <p style="margin: 0 0 12px 0;"><strong style="color: #111827;">Contact:</strong> <span style="color: #374151;">${contact}</span></p>
          <p style="margin: 0;"><strong style="color: #111827;">Type:</strong> <span style="color: #374151;">${type || 'consultation'}</span></p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6b7280; font-size: 14px;">Please contact the customer to provide a quote.</p>
  `

  const html = createEmailTemplate({
    title: 'New Quote Request',
    content,
    complianceText: null
  })

  return _sendEmail({
    to: EMAIL_ROUTING.QUOTES,
    from: EMAIL_FROM,
    subject: `New Quote Request from ${location}`,
    html
  })
}

/**
 * Send newsletter email
 * Routes to: news@sunmega.co.ke (EMAIL_NEWS) or provided recipient
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendNewsletterEmail = async (newsletterData) => {
  const { subject, html, to } = newsletterData

  if (!EMAIL_ROUTING.NEWS && !to) {
    logger.warn('EMAIL_NEWS not configured and no recipient provided, skipping newsletter email')
    return { success: false, skipped: true }
  }

  const recipient = to || EMAIL_ROUTING.NEWS
  const emailSubject = subject || 'Newsletter from SunMega Limited'
  const emailContent = html || '<p>Thank you for subscribing to our newsletter.</p>'

  const fullHtml = createEmailTemplate({
    title: emailSubject,
    content: emailContent,
    complianceText: 'You are receiving this email because you subscribed to our newsletter. You can unsubscribe at any time by clicking the unsubscribe link in this email.'
  })

  return _sendEmail({
    to: recipient,
    from: EMAIL_FROM,
    subject: emailSubject,
    html: fullHtml
  })
}

/**
 * Send system email (generic)
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendSystemEmail = async (systemEmailData) => {
  const { to, subject, html, complianceText } = systemEmailData

  if (!to || !subject || !html) {
    logger.warn('Missing required parameters for system email')
    return { success: false, skipped: true }
  }

  const fullHtml = createEmailTemplate({
    title: subject,
    content: html,
    complianceText: complianceText || null
  })

  return _sendEmail({
    to,
    from: EMAIL_FROM,
    subject,
    html: fullHtml
  })
}

/**
 * Send email verification email
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`
  
  const content = `
    <p style="margin: 0 0 24px 0;">Hello ${user.firstName},</p>
    
    <p style="margin: 0 0 24px 0;">Thank you for registering with SunMega Limited. Please verify your email address by clicking the button below:</p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding: 0 0 24px 0;">
          <a href="${verificationUrl}" style="display: inline-block; padding: 14px 32px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Verify Email Address</a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="margin: 0 0 24px 0; word-break: break-all; color: #16a34a; font-size: 14px;">${verificationUrl}</p>
    
    <p style="margin: 0; color: #6b7280; font-size: 14px;">This verification link will expire in 24 hours. If you didn't create an account, please ignore this email.</p>
  `

  const html = createEmailTemplate({
    title: 'Verify Your Email Address',
    content,
    complianceText: 'You are receiving this email because you created an account on SunMega Limited. If you did not create an account, please ignore this email.'
  })

  return _sendEmail({
    to: user.email,
    from: EMAIL_FROM,
    subject: 'Verify Your Email - SunMega Limited',
    html
  })
}

/**
 * Send password reset email
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`
  
  const content = `
    <p style="margin: 0 0 24px 0;">Hello ${user.firstName},</p>
    
    <p style="margin: 0 0 24px 0;">You requested to reset your password. Click the button below to create a new password:</p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding: 0 0 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">Reset Password</a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 24px 0; color: #6b7280; font-size: 14px;">Or copy and paste this link into your browser:</p>
    <p style="margin: 0 0 24px 0; word-break: break-all; color: #16a34a; font-size: 14px;">${resetUrl}</p>
    
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px; padding: 16px; margin-bottom: 24px;">
      <tr>
        <td>
          <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 600;">⚠️ Security Notice</p>
          <p style="margin: 8px 0 0 0; color: #78350f; font-size: 14px;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.</p>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0; color: #6b7280; font-size: 14px;">For security reasons, never share this link with anyone.</p>
  `

  const html = createEmailTemplate({
    title: 'Reset Your Password',
    content,
    complianceText: 'You are receiving this email because you requested a password reset for your SunMega Limited account. If you did not request this, please ignore this email.'
  })

  return _sendEmail({
    to: user.email,
    from: EMAIL_FROM,
    subject: 'Reset Your Password - SunMega Limited',
    html
  })
}

/**
 * Send order confirmation email
 * From: no-reply@sunmega.co.ke (EMAIL_NO_REPLY)
 */
const sendOrderConfirmationEmail = async (order, user) => {
  const orderUrl = `${process.env.FRONTEND_URL}/orders/${order._id}`
  
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; color: #374151;">${item.name}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; color: #374151;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #374151;">KES ${item.price.toLocaleString()}</td>
      <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #111827; font-weight: 600;">KES ${item.total.toLocaleString()}</td>
    </tr>
  `).join('')
  
  const content = `
    <p style="margin: 0 0 24px 0;">Hello ${user.firstName},</p>
    
    <p style="margin: 0 0 32px 0;">Thank you for your order! We've received your order and will process it shortly.</p>
    
    <!-- Order Details -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 32px;">
      <tr>
        <td>
          <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Order Details</p>
          <p style="margin: 0 0 8px 0;"><strong style="color: #111827;">Order Number:</strong> <span style="color: #374151;">${order.orderNumber}</span></p>
          <p style="margin: 0 0 8px 0;"><strong style="color: #111827;">Order Date:</strong> <span style="color: #374151;">${new Date(order.createdAt).toLocaleDateString()}</span></p>
          <p style="margin: 0 0 8px 0;"><strong style="color: #111827;">Payment Status:</strong> <span style="color: #374151; text-transform: capitalize;">${order.paymentStatus}</span></p>
          <p style="margin: 0;"><strong style="color: #111827;">Order Status:</strong> <span style="color: #374151; text-transform: capitalize;">${order.orderStatus}</span></p>
        </td>
      </tr>
    </table>
    
    <!-- Order Items -->
    <p style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #111827;">Items Ordered</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
      <thead>
        <tr style="background-color: #f9fafb;">
          <th style="padding: 12px; text-align: left; font-weight: 600; color: #111827; font-size: 14px;">Product</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: #111827; font-size: 14px;">Quantity</th>
          <th style="padding: 12px; text-align: right; font-weight: 600; color: #111827; font-size: 14px;">Price</th>
          <th style="padding: 12px; text-align: right; font-weight: 600; color: #111827; font-size: 14px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
      <tfoot style="background-color: #f9fafb;">
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; font-weight: 600; color: #111827; border-top: 2px solid #e5e7eb;">Subtotal:</td>
          <td style="padding: 12px; text-align: right; font-weight: 600; color: #111827; border-top: 2px solid #e5e7eb;">KES ${order.subtotal.toLocaleString()}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; font-weight: 600; color: #111827;">Shipping:</td>
          <td style="padding: 12px; text-align: right; font-weight: 600; color: #111827;">KES ${order.shipping.toLocaleString()}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding: 12px; text-align: right; font-weight: 700; color: #111827; font-size: 16px; border-top: 2px solid #e5e7eb;">Total:</td>
          <td style="padding: 12px; text-align: right; font-weight: 700; color: #16a34a; font-size: 16px; border-top: 2px solid #e5e7eb;">KES ${order.total.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>
    
    <!-- Shipping Address -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f9fafb; border-radius: 6px; padding: 20px; margin-bottom: 32px;">
      <tr>
        <td>
          <p style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #111827;">Shipping Address</p>
          <p style="margin: 0; color: #374151; line-height: 1.8;">
            ${order.shippingAddress.name}<br>
            ${order.shippingAddress.street}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zipCode || ''}<br>
            ${order.shippingAddress.country || 'Kenya'}
          </p>
        </td>
      </tr>
    </table>
    
    <!-- Action Button -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
      <tr>
        <td align="center" style="padding: 0 0 24px 0;">
          <a href="${orderUrl}" style="display: inline-block; padding: 14px 32px; background-color: #16a34a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Order Details</a>
        </td>
      </tr>
    </table>
    
    <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">We'll send you another email when your order ships.</p>
    <p style="margin: 0; color: #6b7280; font-size: 14px;">If you have any questions, please contact our support team at <a href="mailto:${SUPPORT_EMAIL}" style="color: #16a34a; text-decoration: none;">${SUPPORT_EMAIL}</a>.</p>
  `

  const html = createEmailTemplate({
    title: `Order Confirmation #${order.orderNumber}`,
    content,
    complianceText: 'You are receiving this email because you placed an order on SunMega Limited. This is an automated confirmation email.'
  })

  return _sendEmail({
    to: user.email,
    from: EMAIL_FROM,
    subject: `Order Confirmation #${order.orderNumber} - SunMega Limited`,
    html
  })
}

module.exports = {
  sendContactNotification,
  sendQuoteNotification,
  sendNewsletterEmail,
  sendSystemEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail
}
