const Quote = require('../models/Quote')
const { sendQuoteNotification } = require('../utils/emailService')
const logger = require('../utils/logger')

/**
 * @desc    Submit quote request
 * @route   POST /api/quotes
 * @access  Public
 */
const submitQuote = async (req, res, next) => {
  try {
    const { name, email, phone, location, systemSize, installationDate, contact, type } = req.body

    /**
     * QUOTE DATA CONTRACT: Normalize contact field
     * 
     * Backward compatibility: Accept contact field (email or phone string)
     * New contract: Accept email and phone fields separately
     * 
     * Normalization logic:
     * 1. If email provided → use email
     * 2. If phone provided → use phone
     * 3. If contact provided (legacy) → parse into email or phone
     * 4. Preserve contact field for backward compatibility
     */
    let normalizedEmail = email
    let normalizedPhone = phone

    // If contact field provided but email/phone not provided, parse contact
    if (contact && !email && !phone) {
      // Try to determine if contact is email or phone
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (emailPattern.test(contact.trim().toLowerCase())) {
        normalizedEmail = contact.trim().toLowerCase()
      } else {
        // Assume it's a phone number
        normalizedPhone = contact.trim()
      }
    }

    // Normalize type: map frontend values to backend enum
    const validTypes = ['residential', 'commercial', 'industrial', 'consultation']
    const normalizedType = type && validTypes.includes(type.toLowerCase()) 
      ? type.toLowerCase() 
      : 'consultation'

    // Create quote entry with normalized data
    const quote = await Quote.create({
      name: name?.trim() || undefined,
      email: normalizedEmail?.trim() || undefined,
      phone: normalizedPhone?.trim() || undefined,
      location: location.trim(),
      systemSize: systemSize?.trim() || undefined,
      installationDate: installationDate?.trim() || undefined,
      contact: contact?.trim() || normalizedEmail || normalizedPhone || undefined, // Preserve for backward compatibility
      type: normalizedType
    })

    // Send notification email (optional - failures don't break user flow)
    try {
      await sendQuoteNotification({ name, email, phone, location, systemSize, installationDate, contact, type })
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

