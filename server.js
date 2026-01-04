const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const compression = require('compression')
const cookieParser = require('cookie-parser')
const path = require('path')
require('dotenv').config()

const connectDB = require('./config/database')
const errorHandler = require('./middleware/errorHandler')
const logger = require('./utils/logger')
const passport = require('./config/passport')

// Environment variable validation - CONTRACT: Fail fast on missing required vars
const requiredEnvVars = [
  'MONGODB_URI',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'FRONTEND_URL'
]

const missingVars = requiredEnvVars.filter(varName => !process.env[varName])
if (missingVars.length > 0) {
  logger.error('❌ CRITICAL: Missing required environment variables:')
  missingVars.forEach(varName => {
    logger.error(`   - ${varName}`)
  })
  logger.error('')
  logger.error('Server cannot start without these variables.')
  process.exit(1)
}

// Initialize Express app
const app = express()

// Connect to MongoDB
connectDB()

// Security Middleware
app.use(helmet())

// CORS Configuration - CONTRACT: Origins from environment variable
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : []

if (allowedOrigins.length === 0) {
  logger.error('❌ CRITICAL: CORS_ORIGINS environment variable is not set')
  logger.error('Set CORS_ORIGINS as comma-separated list: "https://sunmegalimited.vercel.app,https://sunmega.co.ke"')
  process.exit(1)
}

app.use(
  cors({
    origin: function (origin, callback) {
      // allow server-to-server or tools like Postman
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) {
        return callback(null, true)
      }

      return callback(new Error("CORS not allowed"), false)
    },
    credentials: true
  })
)

// Body Parser Middleware
// Webhook routes need raw body for signature verification
// Use express.raw() for webhooks, express.json() for other routes
app.use('/api/webhooks', express.raw({ type: 'application/json', limit: '10mb' }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Initialize Passport
app.use(passport.initialize())

// Compression
app.use(compression())

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }))
}

// Health Check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  })
})

// Static file serving for uploads with CORS headers
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  next()
})
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'))
)

// Static file serving for public assets (email logo, etc.)
app.use('/assets', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  next()
})
app.use(
  '/assets',
  express.static(path.join(__dirname, 'public', 'assets'))
)

// API Routes
app.use('/api/auth', require('./routes/authRoutes'))
app.use('/api/products', require('./routes/productRoutes'))
app.use('/api/cart', require('./routes/cartRoutes'))
app.use('/api/orders', require('./routes/orderRoutes'))
app.use('/api/payments', require('./routes/paymentRoutes'))
app.use('/api/webhooks', require('./routes/webhookRoutes'))
app.use('/api/contact', require('./routes/contactRoutes'))
app.use('/api/quotes', require('./routes/quoteRoutes'))
app.use('/api/newsletter', require('./routes/newsletterRoutes'))
app.use('/api/users', require('./routes/userRoutes'))
app.use('/api/admin', require('./routes/adminRoutes'))
app.use('/api/reviews', require('./routes/reviewRoutes'))
app.use('/api/wishlist', require('./routes/wishlistRoutes'))
app.use('/api/cms', require('./routes/cmsRoutes'))
app.use('/api/admin/cms', require('./routes/cmsRoutes'))
app.use('/api', require('./routes/pageContentRoutes'))
app.use('/api/admin', require('./routes/pageContentRoutes'))

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Route not found',
      code: 'NOT_FOUND'
    }
  })
})

// Error Handler (must be last)
app.use(errorHandler)

// Start Server
const PORT = process.env.PORT || 5000

const server = app.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`)
  logger.info(`CORS origins: ${allowedOrigins.join(', ')}`)
})

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err)
  server.close(() => {
    process.exit(1)
  })
})

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err)
  process.exit(1)
})

module.exports = app

