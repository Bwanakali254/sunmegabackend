const mongoose = require('mongoose')
const logger = require('../utils/logger')

let isConnecting = false
let connectionRetries = 0
const MAX_RETRIES = 5
const RETRY_DELAY = 5000 // 5 seconds

/**
 * Attempt MongoDB connection with retry logic
 */
const attemptConnection = async () => {
  if (isConnecting) {
    return // Already attempting connection
  }

  // MONGODB_URI validation is handled in server.js startup
  // This function assumes it's already validated

  isConnecting = true
  connectionRetries++

  try {
    logger.info(`Attempting MongoDB connection (attempt ${connectionRetries}/${MAX_RETRIES})...`)
    
    // Simple connection - Mongoose 8.x handles retries internally
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // 10 second timeout
      socketTimeoutMS: 45000,
    })

    logger.info(`✅ MongoDB Connected: ${conn.connection.host}`)
    logger.info(`✅ Database: ${conn.connection.name}`)
    connectionRetries = 0 // Reset on success
    isConnecting = false
    return true
  } catch (error) {
    isConnecting = false
    
    // Check if it's a DNS/network error
    if (error.message?.includes('ETIMEOUT') || error.message?.includes('queryTxt') || error.message?.includes('ENOTFOUND')) {
      logger.error(`❌ DNS/Network Error (attempt ${connectionRetries}/${MAX_RETRIES}): ${error.message}`)
      
      if (connectionRetries === 1) {
        // First attempt - provide helpful guidance
        logger.error('')
        logger.error('🔧 DNS Resolution Failed - MongoDB Atlas hostname cannot be resolved.')
        logger.error('   This is a network/DNS configuration issue, not a code problem.')
        logger.error('')
        logger.error('   Quick Fixes:')
        logger.error('   1. MongoDB Atlas → Network Access → IP Access List → Add 0.0.0.0/0')
        logger.error('   2. Run: ipconfig /flushdns (Windows PowerShell as Admin)')
        logger.error('   3. Check internet connection')
        logger.error('   4. Wait 2-3 minutes after adding IP to Atlas')
        logger.error('')
      }
    } else if (error.message?.includes('authentication failed') || error.message?.includes('bad auth')) {
      logger.error(`❌ Authentication Error: ${error.message}`)
      logger.error('   Check: Username, password, and special characters in MONGODB_URI')
      // Don't retry auth errors
      return false
    } else {
      logger.error(`❌ MongoDB Connection Error (attempt ${connectionRetries}/${MAX_RETRIES}): ${error.message}`)
    }

    // Retry if we haven't exceeded max retries
    if (connectionRetries < MAX_RETRIES) {
      const delay = RETRY_DELAY * connectionRetries // Exponential backoff
      logger.info(`⏳ Retrying in ${delay / 1000} seconds...`)
      
      setTimeout(() => {
        attemptConnection()
      }, delay)
    } else {
      logger.error('')
      logger.error('❌ Max connection retries reached. Server will start but database operations will fail.')
      logger.error('⚠️  Please fix the MongoDB connection issue and restart the server.')
      logger.error('')
      connectionRetries = 0 // Reset for manual retry
    }

    return false
  }
}

/**
 * Initialize MongoDB connection
 */
const connectDB = async () => {
  // Set connection options before connecting
  mongoose.set('strictQuery', false)
  
  // Attempt initial connection
  await attemptConnection()
}

// Handle connection events - graceful reconnection
mongoose.connection.on('disconnected', () => {
  logger.warn('⚠️  MongoDB disconnected')
  
  // Auto-reconnect if not already connecting
  if (!isConnecting && mongoose.connection.readyState === 0) {
    logger.info('🔄 Attempting to reconnect...')
    connectionRetries = 0 // Reset retry count
    setTimeout(() => {
      attemptConnection()
    }, RETRY_DELAY)
  }
})

mongoose.connection.on('connected', () => {
  logger.info('✅ MongoDB connection established')
})

mongoose.connection.on('error', (err) => {
  logger.error('❌ MongoDB connection error:', err.message)
  // Don't crash - let retry logic handle it
})

// Handle process termination gracefully
process.on('SIGINT', async () => {
  await mongoose.connection.close()
  logger.info('MongoDB connection closed due to application termination')
  process.exit(0)
})

module.exports = connectDB

