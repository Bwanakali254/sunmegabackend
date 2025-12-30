const User = require('../models/User')
const { generateToken, generateRefreshToken } = require('../utils/generateToken')
const logger = require('../utils/logger')

/**
 * @desc    Handle OAuth callback and create/login user
 * @route   GET /api/auth/oauth/:provider/callback
 * @access  Public
 */
const handleOAuthCallback = async (req, res, next) => {
  try {
    // Determine provider from the route path
    const provider = req.path.includes('google') ? 'google' : 'facebook'
    const profile = req.user // Passport sets this

    if (!profile || !profile.id) {
      logger.error('OAuth callback: No profile received', { provider, hasUser: !!req.user })
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
    }

    // Validate profile data
    if (!profile.id || typeof profile.id !== 'string') {
      logger.error('OAuth callback: Invalid profile ID', { provider })
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_failed`)
    }

    const email = profile.email?.toLowerCase() || profile.emails?.[0]?.value?.toLowerCase()
    
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      logger.error('OAuth callback: No valid email in profile', { provider, hasEmail: !!email })
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=no_email`)
    }

    // Find or create user
    let user = await User.findOne({
      $or: [
        { email },
        { providerId: profile.id, provider }
      ]
    })

    if (user) {
      // User exists - update provider info if needed
      if (!user.providerId && profile.id) {
        user.providerId = profile.id
        user.provider = provider
      }
      if (!user.emailVerified && email) {
        user.emailVerified = true
      }
      // Update name if not set
      if (!user.firstName || !user.lastName) {
        const nameParts = (profile.displayName || profile.name || '').split(' ')
        if (!user.firstName) user.firstName = nameParts[0] || profile.given_name || 'User'
        if (!user.lastName) user.lastName = nameParts.slice(1).join(' ') || profile.family_name || ''
      }
      await user.save()
    } else {
      // Create new user
      const nameParts = (profile.displayName || profile.name || '').split(' ')
      const firstName = nameParts[0] || profile.given_name || 'User'
      const lastName = nameParts.slice(1).join(' ') || profile.family_name || ''

      user = await User.create({
        firstName,
        lastName,
        email,
        phone: profile.phone || '',
        provider,
        providerId: profile.id,
        emailVerified: true, // OAuth emails are pre-verified
        password: undefined // No password for OAuth users
      })
    }

    // Generate tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken(user._id)

    // Set refresh token in HttpOnly cookie for security
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    // Redirect to frontend with access token
    const redirectUrl = `${process.env.FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`

    res.redirect(redirectUrl)
  } catch (error) {
    logger.error('OAuth callback error:', error)
    res.redirect(`${process.env.FRONTEND_URL}/login?error=oauth_error`)
  }
}

/**
 * @desc    Initiate OAuth flow
 * @route   GET /api/auth/oauth/:provider
 * @access  Public
 */
const initiateOAuth = (req, res, next) => {
  // This is handled by Passport middleware
  // Just pass through
  next()
}

module.exports = {
  handleOAuthCallback,
  initiateOAuth
}

