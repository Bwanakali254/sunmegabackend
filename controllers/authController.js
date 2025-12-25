const crypto = require('crypto')
const User = require('../models/User')
const { generateToken, generateRefreshToken } = require('../utils/generateToken')
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService')
const logger = require('../utils/logger')

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'User already exists with this email',
          code: 'USER_EXISTS'
        }
      })
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex')

    // Create user
    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      emailVerificationToken
    })

    // Generate tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken(user._id)

    // Send verification email
    try {
      await sendVerificationEmail(user, emailVerificationToken)
    } catch (emailError) {
      logger.error('Error sending verification email:', emailError)
      // Don't fail registration if email fails
    }

    // Set refresh token in cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified
        },
        token,
        message: 'Registration successful. Please check your email to verify your account.'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    // Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password')

    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        }
      })
    }

    // Check password
    const isPasswordMatch = await user.matchPassword(password)
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS'
        }
      })
    }

    // Generate tokens
    const token = generateToken(user._id)
    const refreshToken = generateRefreshToken(user._id)

    // Set refresh token in cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified
        },
        token
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  // Clear refresh token cookie
  res.cookie('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0)
  })

  // Clear access token cookie if it exists
  res.cookie('token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(0)
  })

  res.json({
    success: true,
    message: 'Logged out successfully'
  })
}

/**
 * @desc    Get current user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  const user = await User.findById(req.user.id)

  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        emailVerified: user.emailVerified,
        addresses: user.addresses
      }
    }
  })
}

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body

    const user = await User.findOne({ email })
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex')
    // Hash token before storing
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    user.passwordResetToken = hashedToken
    user.passwordResetExpires = Date.now() + 60 * 60 * 1000 // 1 hour
    await user.save({ validateBeforeSave: false })

    // Send reset email (use plain token for URL)
    try {
      await sendPasswordResetEmail(user, resetToken)
      res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      })
    } catch (emailError) {
      logger.error('Error sending password reset email:', emailError)
      user.passwordResetToken = undefined
      user.passwordResetExpires = undefined
      await user.save({ validateBeforeSave: false })

      return res.status(500).json({
        success: false,
        error: {
          message: 'Email could not be sent',
          code: 'EMAIL_ERROR'
        }
      })
    }
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Reset password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body

    // Hash token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex')

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid or expired reset token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    // Set new password
    user.password = password
    user.passwordResetToken = undefined
    user.passwordResetExpires = undefined
    await user.save()

    // Generate new token
    const authToken = generateToken(user._id)

    res.json({
      success: true,
      data: {
        token: authToken,
        message: 'Password reset successful'
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Verify email
 * @route   GET /api/auth/verify-email/:token
 * @access  Public
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params

    const user = await User.findOne({
      emailVerificationToken: token
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid verification token',
          code: 'INVALID_TOKEN'
        }
      })
    }

    if (user.emailVerified) {
      return res.json({
        success: true,
        message: 'Email already verified'
      })
    }

    user.emailVerified = true
    user.emailVerificationToken = undefined
    await user.save()

    res.json({
      success: true,
      message: 'Email verified successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/update-profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone } = req.body

    const user = await User.findById(req.user.id)

    if (firstName) user.firstName = firstName
    if (lastName) user.lastName = lastName
    if (phone) user.phone = phone

    await user.save()

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          emailVerified: user.emailVerified
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Change password
 * @route   PUT /api/auth/change-password
 * @access  Private
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body

    const user = await User.findById(req.user.id).select('+password')

    // Check current password
    const isPasswordMatch = await user.matchPassword(currentPassword)
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Current password is incorrect',
          code: 'INVALID_PASSWORD'
        }
      })
    }

    // Update password
    user.password = newPassword
    await user.save()

    res.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public (with refresh token)
 */
const refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Refresh token not provided',
          code: 'NO_REFRESH_TOKEN'
        }
      })
    }

    const jwt = require('jsonwebtoken')
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET)

    const user = await User.findById(decoded.id)
    if (!user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND'
        }
      })
    }

    const newToken = generateToken(user._id)
    const newRefreshToken = generateRefreshToken(user._id)

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    })

    res.json({
      success: true,
      data: {
        token: newToken
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  verifyEmail,
  updateProfile,
  changePassword,
  refreshToken
}

