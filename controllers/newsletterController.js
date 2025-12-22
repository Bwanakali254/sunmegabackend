const Newsletter = require('../models/Newsletter')
const logger = require('../utils/logger')

/**
 * @desc    Subscribe to newsletter
 * @route   POST /api/newsletter/subscribe
 * @access  Public
 */
const subscribe = async (req, res, next) => {
  try {
    const { email } = req.body

    // Check if already subscribed
    let newsletter = await Newsletter.findOne({ email })

    if (newsletter) {
      if (newsletter.subscribed) {
        return res.json({
          success: true,
          message: 'You are already subscribed to our newsletter'
        })
      } else {
        // Resubscribe
        newsletter.subscribed = true
        newsletter.subscribedAt = new Date()
        newsletter.unsubscribedAt = undefined
        await newsletter.save()

        return res.json({
          success: true,
          message: 'Successfully resubscribed to our newsletter'
        })
      }
    }

    // Create new subscription
    newsletter = await Newsletter.create({
      email,
      subscribed: true,
      subscribedAt: new Date()
    })

    res.status(201).json({
      success: true,
      data: {
        email: newsletter.email,
        subscribed: newsletter.subscribed
      },
      message: 'Successfully subscribed to our newsletter'
    })
  } catch (error) {
    // Handle duplicate email error
    if (error.code === 11000) {
      return res.json({
        success: true,
        message: 'You are already subscribed to our newsletter'
      })
    }
    next(error)
  }
}

/**
 * @desc    Unsubscribe from newsletter
 * @route   POST /api/newsletter/unsubscribe
 * @access  Public
 */
const unsubscribe = async (req, res, next) => {
  try {
    const { email } = req.body

    const newsletter = await Newsletter.findOne({ email })

    if (!newsletter) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Email not found in our newsletter list',
          code: 'EMAIL_NOT_FOUND'
        }
      })
    }

    if (!newsletter.subscribed) {
      return res.json({
        success: true,
        message: 'You are already unsubscribed'
      })
    }

    newsletter.subscribed = false
    newsletter.unsubscribedAt = new Date()
    await newsletter.save()

    res.json({
      success: true,
      message: 'Successfully unsubscribed from our newsletter'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get all newsletter subscribers (Admin only)
 * @route   GET /api/newsletter
 * @access  Private/Admin
 */
const getSubscribers = async (req, res, next) => {
  try {
    const { subscribed, page = 1, limit = 50 } = req.query

    const query = {}
    if (subscribed !== undefined) {
      query.subscribed = subscribed === 'true'
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const subscribers = await Newsletter.find(query)
      .sort({ subscribedAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Newsletter.countDocuments(query)

    res.json({
      success: true,
      data: {
        subscribers,
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

module.exports = {
  subscribe,
  unsubscribe,
  getSubscribers
}

