const multer = require('multer')
const path = require('path')
const fs = require('fs')
const logger = require('../utils/logger')

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '-')
    cb(null, `${name}-${uniqueSuffix}${ext}`)
  }
})

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (mimetype && extname) {
    return cb(null, true)
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'))
  }
}

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB max file size
  },
  fileFilter: fileFilter
})

// Middleware for single image upload
const uploadSingle = (fieldName = 'image') => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        logger.error('Upload error:', err)
        return res.status(400).json({
          success: false,
          error: {
            message: err.message || 'File upload failed',
            code: 'UPLOAD_ERROR'
          }
        })
      }
      next()
    })
  }
}

// Middleware for multiple image uploads
const uploadMultiple = (fieldName = 'images', maxCount = 10) => {
  return (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, (err) => {
      if (err) {
        logger.error('Upload error:', err)
        return res.status(400).json({
          success: false,
          error: {
            message: err.message || 'File upload failed',
            code: 'UPLOAD_ERROR'
          }
        })
      }
      next()
    })
  }
}

// Helper to get file URL
const getFileUrl = (filename) => {
  if (!filename) return null
  const baseUrl = process.env.BACKEND_URL || 'http://localhost:5000'
  return `${baseUrl}/uploads/${filename}`
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  getFileUrl
}

