const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const FacebookStrategy = require('passport-facebook').Strategy
const User = require('../models/User')
const logger = require('../utils/logger')

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user._id)
})

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id)
    done(null, user)
  } catch (error) {
    done(error, null)
  }
})

// Google OAuth Strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/oauth/google/callback'
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Pass the profile to the callback handler
          done(null, {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            name: profile.name,
            given_name: profile.name?.givenName,
            family_name: profile.name?.familyName,
            photos: profile.photos
          })
        } catch (error) {
          logger.error('Google OAuth error:', error)
          done(error, null)
        }
      }
    )
  )
} else {
  logger.warn('Google OAuth credentials not configured')
}

// Facebook OAuth Strategy
if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: process.env.FACEBOOK_CALLBACK_URL || '/api/auth/oauth/facebook/callback',
        profileFields: ['id', 'displayName', 'email', 'name', 'picture']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Pass the profile to the callback handler
          done(null, {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            displayName: profile.displayName,
            name: profile.name,
            given_name: profile.name?.givenName,
            family_name: profile.name?.familyName,
            photos: profile.photos
          })
        } catch (error) {
          logger.error('Facebook OAuth error:', error)
          done(error, null)
        }
      }
    )
  )
} else {
  logger.warn('Facebook OAuth credentials not configured')
}

module.exports = passport

