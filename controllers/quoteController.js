const Quote = require('../models/Quote')
const { sendEmail } = require('../utils/emailService')
const logger = require('../utils/logger')

/**
 * @desc    Submit quote request
 * @route   POST /api/quotes
 * @access  Public
 */
const submitQuote = async (req, res, next) => {
  try {
    const { name, email, phone, location, systemSize, installationDate, contact, type } = req.body

    // Create quote entry
    const quote = await Quote.create({
      name,
      email,
      phone,
      location,
      systemSize,
      installationDate,
      contact,
      type: type || 'consultation'
    })

    // Send notification email (optional)
    try {
      await sendEmail({
        to: process.env.EMAIL_USER || 'admin@sunmega.com',
        subject: `New Quote Request from ${location}`,
        html: `
          <h2>New Quote Request</h2>
          ${name ? `<p><strong>Name:</strong> ${name}</p>` : ''}
          ${email ? `<p><strong>Email:</strong> ${email}</p>` : ''}
          ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
          <p><strong>Location:</strong> ${location}</p>
          ${systemSize ? `<p><strong>System Size:</strong> ${systemSize}</p>` : ''}
          ${installationDate ? `<p><strong>Preferred Installation Date:</strong> ${installationDate}</p>` : ''}
          <p><strong>Contact:</strong> ${contact}</p>
          <p><strong>Type:</strong> ${type || 'consultation'}</p>
        `
      })
    } catch (emailError) {
      logger.error('Error sending quote notification email:', emailError)
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      data: {
        quote: {
          id: quote._id,
          location: quote.location,
          type: quote.type,
          status: quote.status
        },
        message: 'Quote request submitted successfully! We will contact you soon.'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get all quotes (Admin only)
 * @route   GET /api/quotes
 * @access  Private/Admin
 */
const getQuotes = async (req, res, next) => {
  try {
    const { status, type, page = 1, limit = 20 } = req.query

    const query = {}
    if (status) {
      query.status = status
    }
    if (type) {
      query.type = type
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const quotes = await Quote.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Quote.countDocuments(query)

    res.json({
      success: true,
      data: {
        quotes,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update quote status (Admin only)
 * @route   PUT /api/quotes/:id/status
 * @access  Private/Admin
 */
const updateQuoteStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status, notes } = req.body

    const quote = await Quote.findById(id)
    if (!quote) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Quote not found',
          code: 'QUOTE_NOT_FOUND'
        }
      })
    }

    if (status) {
      quote.status = status
    }
    if (notes) {
      quote.notes = notes
    }

    await quote.save()

    res.json({
      success: true,
      data: {
        quote,
        message: 'Quote status updated'
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  submitQuote,
  getQuotes,
  updateQuoteStatus
}

