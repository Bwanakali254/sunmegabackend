const Contact = require('../models/Contact')
const { sendContactNotification } = require('../utils/emailService')
const logger = require('../utils/logger')

/**
 * @desc    Submit contact form
 * @route   POST /api/contact
 * @access  Public
 */
const submitContact = async (req, res, next) => {
  try {
    const { name, email, phone, subject, message } = req.body

    // Create contact entry
    const contact = await Contact.create({
      name,
      email,
      phone,
      subject,
      message
    })

    // Send notification email (optional - failures don't break user flow)
    try {
      await sendContactNotification({ name, email, phone, subject, message })
    } catch (emailError) {
      logger.error('Error sending contact notification email:', emailError)
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      data: {
        contact: {
          id: contact._id,
          name: contact.name,
          email: contact.email,
          subject: contact.subject,
          status: contact.status
        },
        message: 'Your message has been sent successfully. We will get back to you soon.'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get all contacts (Admin only)
 * @route   GET /api/contact
 * @access  Private/Admin
 */
const getContacts = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query

    const query = {}
    if (status) {
      query.status = status
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const contacts = await Contact.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Contact.countDocuments(query)

    res.json({
      success: true,
      data: {
        contacts,
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
 * @desc    Update contact status (Admin only)
 * @route   PUT /api/contact/:id/status
 * @access  Private/Admin
 */
const updateContactStatus = async (req, res, next) => {
  try {
    const { id } = req.params
    const { status } = req.body

    const contact = await Contact.findById(id)
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Contact not found',
          code: 'CONTACT_NOT_FOUND'
        }
      })
    }

    contact.status = status
    await contact.save()

    res.json({
      success: true,
      data: {
        contact,
        message: 'Contact status updated'
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  submitContact,
  getContacts,
  updateContactStatus
}

