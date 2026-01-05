const multer = require('multer')
const path = require('path')
const fs = require('fs')
const logger = require('../utils/logger')
const { uploadImage, isCloudinaryUrl, isConfigured } = require('../services/cloudinaryService')

/**
 * STORAGE PERSISTENCE:
 * 
 * Images are stored in Cloudinary for persistent storage across server restarts.
 * 
 * For Render deployments:
 * - Default filesystem is EPHEMERAL (files lost on restart)
 * - SOLUTION: Cloudinary provides persistent cloud storage with CDN
 * 
 * Backward Compatibility:
 * - Existing products with /uploads/ paths continue to work (until server restart)
 * - New uploads use Cloudinary URLs
 */

// Memory storage for Cloudinary (buffer in memory, then upload to Cloudinary)
const memoryStorage = multer.memoryStorage()

// Disk storage fallback (if Cloudinary not configured, for local development)
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '-')
    cb(null, `${name}-${uniqueSuffix}${ext}`)
  }
})

// Use memory storage if Cloudinary configured, otherwise disk storage
const storage = isConfigured() ? memoryStorage : diskStorage

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
// Uploads to Cloudinary if configured, otherwise uses disk storage
const uploadSingle = (fieldName = 'image') => {
  return async (req, res, next) => {
    upload.single(fieldName)(req, res, async (err) => {
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

      // If Cloudinary is configured and file was uploaded, upload to Cloudinary
      if (isConfigured() && req.file) {
        try {
          const { url } = await uploadImage(req.file.buffer, req.file.originalname)
          // Store Cloudinary URL in file object for controller access
          req.file.cloudinaryUrl = url
          req.file.filename = url // Use URL as filename for backward compatibility
          logger.info(`Successfully uploaded image to Cloudinary: ${url}`)
        } catch (cloudinaryError) {
          logger.error('Cloudinary upload failed:', cloudinaryError)
          return res.status(500).json({
            success: false,
            error: {
              message: 'Failed to upload image to cloud storage',
              code: 'CLOUDINARY_UPLOAD_ERROR'
            }
          })
        }
      }

      next()
    })
  }
}

// Middleware for multiple image uploads
// Uploads to Cloudinary if configured, otherwise uses disk storage
const uploadMultiple = (fieldName = 'images', maxCount = 10) => {
  return async (req, res, next) => {
    upload.array(fieldName, maxCount)(req, res, async (err) => {
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

      // If Cloudinary is configured and files were uploaded, upload to Cloudinary
      if (isConfigured() && req.files && req.files.length > 0) {
        try {
          const uploadPromises = req.files.map(async (file) => {
            try {
              const { url } = await uploadImage(file.buffer, file.originalname)
              // Store Cloudinary URL in file object for controller access
              file.cloudinaryUrl = url
              file.filename = url // Use URL as filename for backward compatibility
              return file
            } catch (uploadError) {
              logger.error(`Failed to upload ${file.originalname} to Cloudinary:`, uploadError)
              throw uploadError
            }
          })

          req.files = await Promise.all(uploadPromises)
          logger.info(`Successfully uploaded ${req.files.length} image(s) to Cloudinary`)
        } catch (cloudinaryError) {
          logger.error('Cloudinary upload failed:', cloudinaryError)
          return res.status(500).json({
            success: false,
            error: {
              message: 'Failed to upload images to cloud storage',
              code: 'CLOUDINARY_UPLOAD_ERROR'
            }
          })
        }
      }

      next()
    })
  }
}

// Helper to get file URL (Cloudinary URL or relative path for backward compatibility)
const getFileUrl = (filename) => {
  if (!filename) return null
  
  // If it's already a Cloudinary URL (from new uploads), return as-is
  if (isCloudinaryUrl(filename)) {
    return filename
  }
  
  // For backward compatibility: existing /uploads/ paths
  // Return relative path - frontend will construct full URL
  return `/uploads/${filename}`
}

/**
 * Verify file exists (Cloudinary URL or disk file)
 * For Cloudinary URLs, assume they exist (Cloudinary handles persistence)
 * @param {string} filename - Filename or Cloudinary URL to verify
 * @returns {boolean} - True if file exists or is Cloudinary URL
 */
const verifyFileExists = (filename) => {
  if (!filename) return false
  
  // Cloudinary URLs are always "valid" (persistent)
  if (isCloudinaryUrl(filename)) {
    return true
  }
  
  // For disk storage (backward compatibility), check file exists
  const filePath = path.join(uploadsDir, filename)
  const exists = fs.existsSync(filePath)
  if (!exists) {
    logger.warn(`Uploaded file not found on disk: ${filename} - Possible ephemeral filesystem issue`)
  }
  return exists
}

/**
 * Delete file (Cloudinary or disk)
 * Used when updating products to clean up old images
 * @param {string} filename - Cloudinary URL or filename to delete
 * @returns {Promise<boolean>} - True if file was deleted or didn't exist
 */
const deleteFile = async (filename) => {
  if (!filename) return true
  
  // If Cloudinary URL, delete from Cloudinary
  if (isCloudinaryUrl(filename)) {
    const { deleteImage } = require('../services/cloudinaryService')
    return await deleteImage(filename)
  }
  
  // For disk storage (backward compatibility), delete from disk
  try {
    const cleanFilename = filename.replace(/^\/uploads\//, '')
    const filePath = path.join(uploadsDir, cleanFilename)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      logger.info(`Deleted image file from disk: ${cleanFilename}`)
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

