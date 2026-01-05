/**
 * ENVIRONMENT CONFIGURATION VALIDATION
 * 
 * Validates all required environment variables at startup.
 * Fails fast if any required variable is missing.
 */

const logger = require('../utils/logger')

// Required environment variables
const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL'
]

// Optional environment variables with defaults
const optionalEnvVars = {
  REDIS_URL: null, // Redis is optional (caching)
  PESAPAL_CONSUMER_KEY: null,
  PESAPAL_CONSUMER_SECRET: null,
  PESAPAL_ENV: 'sandbox',
  CLOUDINARY_URL: null,
  CORS_ORIGINS: null,
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d'
}

/**
 * Validate environment variables
 * @throws {Error} If any required variable is missing
 */
function validateEnv() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    logger.error('❌ CRITICAL: Missing required environment variables:')
    missing.forEach(varName => {
      logger.error(`   - ${varName}`)
    })
    logger.error('')
    logger.error('Server cannot start without these variables.')
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
  
  // Set defaults for optional variables
  Object.entries(optionalEnvVars).forEach(([key, defaultValue]) => {
    if (!process.env[key] && defaultValue !== null) {
      process.env[key] = defaultValue
    }
  })
  
  logger.info('✅ Environment variables validated')
}

module.exports = {
  validateEnv,
  requiredEnvVars,
  optionalEnvVars
}
