const multer = require('multer')
const path = require('path')
const fs = require('fs')
const logger = require('../utils/logger')

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

/**
 * STORAGE PERSISTENCE NOTE:
 * 
 * Images are stored in backend/uploads/ directory.
 * 
 * DEPLOYMENT REQUIREMENT: This directory MUST be persistent across server restarts.
 * 
 * For Render deployments:
 * - Default filesystem is EPHEMERAL (files lost on restart)
 * - SOLUTION: Configure a Render Disk Volume and mount it to backend/uploads/
 * - OR: Use cloud storage (S3/Cloudinary) - requires additional implementation
 * 
 * File existence is verified after upload to detect persistence issues.
 */

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

// Helper to get relative file path (contract: database stores relative paths only)
const getFileUrl = (filename) => {
  if (!filename) return null
  // Return relative path only - frontend will construct full URL
  return `/uploads/${filename}`
}

/**
 * Verify file exists on disk after upload
 * This helps detect if filesystem is ephemeral (files lost on restart)
 * @param {string} filename - Filename to verify
 * @returns {boolean} - True if file exists
 */
const verifyFileExists = (filename) => {
  if (!filename) return false
  const filePath = path.join(uploadsDir, filename)
  const exists = fs.existsSync(filePath)
  if (!exists) {
    logger.warn(`Uploaded file not found on disk: ${filename} - Possible ephemeral filesystem issue`)
  }
  return exists
}

/**
 * Delete file from disk
 * Used when updating products to clean up old images
 * @param {string} filename - Filename to delete (without /uploads/ prefix)
 * @returns {boolean} - True if file was deleted or didn't exist
 */
const deleteFile = (filename) => {
  if (!filename) return true
  try {
    // Remove /uploads/ prefix if present (defensive)
    const cleanFilename = filename.replace(/^\/uploads\//, '')
    const filePath = path.join(uploadsDir, cleanFilename)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      logger.info(`Deleted image file: ${cleanFilename}`)
      return true
    }
    // File doesn't exist (may have been deleted already or on ephemeral filesystem)
    return true
  } catch (error) {
    logger.error(`Error deleting file ${filename}:`, error)
    // Don't throw - file deletion failure shouldn't break product updates
    return false
  }
}

module.exports = {
  uploadSingle,
  uploadMultiple,
  getFileUrl,
  verifyFileExists,
  deleteFile
}

