const nodemailer = require('nodemailer')
const logger = require('./logger')

// Create email transporter
const createTransporter = () => {
  // For development, use console logging
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    return {
      sendMail: async (options) => {
        logger.info('📧 Email would be sent:', {
          to: options.to,
          subject: options.subject,
          // Don't log HTML content
        })
        return { messageId: 'dev-email-id' }
      }
    }
  }

  // Production email configuration
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  })
}

const transporter = createTransporter()

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email HTML content
 * @param {string} options.text - Email text content (optional)
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@sunmega.com',
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, '') // Strip HTML for text version
    }

    const info = await transporter.sendMail(mailOptions)
    logger.info(`Email sent successfully to ${to}: ${info.messageId}`)
    return { success: true, messageId: info.messageId }
  } catch (error) {
    logger.error('Error sending email:', error)
    throw error
  }
}

/**
 * Send email verification email
 */
const sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌞 Sun Mega Limited</h1>
        </div>
        <div class="content">
          <h2>Verify Your Email Address</h2>
          <p>Hello ${user.firstName},</p>
          <p>Thank you for registering with Sun Mega Limited. Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Sun Mega Limited. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: user.email,
    subject: 'Verify Your Email - Sun Mega Limited',
    html
  })
}

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌞 Sun Mega Limited</h1>
        </div>
        <div class="content">
          <h2>Reset Your Password</h2>
          <p>Hello ${user.firstName},</p>
          <p>You requested to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all;">${resetUrl}</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Sun Mega Limited. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: user.email,
    subject: 'Reset Your Password - Sun Mega Limited',
    html
  })
}

/**
 * Send order confirmation email
 */
const sendOrderConfirmationEmail = async (order, user) => {
  const orderUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/orders/${order._id}`
  
  const itemsHtml = order.items.map(item => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">KES ${item.price.toLocaleString()}</td>
      <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">KES ${item.total.toLocaleString()}</td>
    </tr>
  `).join('')
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .button { display: inline-block; padding: 12px 24px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background-color: #e5e7eb; padding: 10px; text-align: left; font-weight: bold; }
        .total-row { font-weight: bold; background-color: #f3f4f6; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🌞 Sun Mega Limited</h1>
        </div>
        <div class="content">
          <h2>Order Confirmation</h2>
          <p>Hello ${user.firstName},</p>
          <p>Thank you for your order! We've received your order and will process it shortly.</p>
          
          <h3>Order Details</h3>
          <p><strong>Order Number:</strong> ${order.orderNumber}</p>
          <p><strong>Order Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <p><strong>Payment Status:</strong> ${order.paymentStatus}</p>
          <p><strong>Order Status:</strong> ${order.orderStatus}</p>
          
          <h3>Items Ordered</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th style="text-align: center;">Quantity</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="3" style="text-align: right; padding: 10px;">Subtotal:</td>
                <td style="text-align: right; padding: 10px;">KES ${order.subtotal.toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="text-align: right; padding: 10px;">Shipping:</td>
                <td style="text-align: right; padding: 10px;">KES ${order.shipping.toLocaleString()}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="text-align: right; padding: 10px;">Total:</td>
                <td style="text-align: right; padding: 10px;">KES ${order.total.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
          
          <h3>Shipping Address</h3>
          <p>
            ${order.shippingAddress.name}<br>
            ${order.shippingAddress.street}<br>
            ${order.shippingAddress.city}, ${order.shippingAddress.state || ''} ${order.shippingAddress.zipCode || ''}<br>
            ${order.shippingAddress.country || 'Kenya'}
          </p>
          
          <a href="${orderUrl}" class="button">View Order Details</a>
          
          <p>We'll send you another email when your order ships.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Sun Mega Limited. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail({
    to: user.email,
    subject: `Order Confirmation #${order.orderNumber} - Sun Mega Limited`,
    html
  })
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail
}

