const cloudinary = require('cloudinary').v2
const { Readable } = require('stream')
const logger = require('../utils/logger')

/**
 * CLOUDINARY SERVICE
 * 
 * Handles image upload, deletion, and URL generation for Cloudinary storage.
 * Provides persistent image storage that survives server restarts.
 * 
 * Environment Variables Required:
 * - CLOUDINARY_CLOUD_NAME
 * - CLOUDINARY_API_KEY
 * - CLOUDINARY_API_SECRET
 */

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true // Use HTTPS
  })
  logger.info('Cloudinary configured successfully')
} else {
  logger.warn('Cloudinary credentials not found. Image uploads will fail. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.')
}

/**
 * Upload image buffer to Cloudinary
 * @param {Buffer} buffer - Image file buffer
 * @param {string} filename - Original filename (for extension detection)
 * @returns {Promise<{url: string, publicId: string}>} - Cloudinary URL and public ID
 */
const uploadImage = async (buffer, filename) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error('Cloudinary not configured. Please set environment variables.')
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'sunmega/products', // Organize images in folder
        resource_type: 'image',
        format: 'auto', // Auto-optimize format (WebP when supported)
        quality: 'auto', // Auto-optimize quality
        fetch_format: 'auto' // Deliver best format for browser
      },
      (error, result) => {
        if (error) {
          logger.error('Cloudinary upload error:', error)
          reject(error)
        } else {
          logger.info(`Image uploaded to Cloudinary: ${result.public_id}`)
          resolve({
            url: result.secure_url, // HTTPS URL
            publicId: result.public_id
          })
        }
      }
    )

    // Convert buffer to stream
    const readableStream = new Readable()
    readableStream.push(buffer)
    readableStream.push(null)
    readableStream.pipe(uploadStream)
  })
}

/**
 * Delete image from Cloudinary
 * @param {string} imageUrl - Full Cloudinary URL or public ID
 * @returns {Promise<boolean>} - True if deleted or didn't exist
 */
const deleteImage = async (imageUrl) => {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    logger.warn('Cloudinary not configured. Cannot delete image.')
    return true // Don't fail if Cloudinary not configured
  }

  if (!imageUrl) {
    return true
  }

  try {
    // Extract public ID from URL or use as-is if it's already a public ID
    let publicId = imageUrl
    
    // If it's a Cloudinary URL, extract public ID
    if (imageUrl.includes('cloudinary.com')) {
      // Extract public ID from URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/public_id.ext
      const urlParts = imageUrl.split('/')
      const uploadIndex = urlParts.findIndex(part => part === 'upload')
      if (uploadIndex > -1 && urlParts[uploadIndex + 1]) {
        // Get everything after 'upload' and before file extension
        const afterUpload = urlParts.slice(uploadIndex + 2).join('/') // Skip version number
        publicId = afterUpload.replace(/\.[^/.]+$/, '') // Remove extension
      }
    }

    // Remove folder prefix if present (we store as 'sunmega/products/public_id')
    if (publicId.startsWith('sunmega/products/')) {
      publicId = publicId.replace('sunmega/products/', '')
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'image'
    })

    if (result.result === 'ok' || result.result === 'not found') {
      logger.info(`Image deleted from Cloudinary: ${publicId}`)
      return true
    } else {
      logger.warn(`Failed to delete image from Cloudinary: ${publicId}`, result)
      return false
    }
  } catch (error) {
    logger.error(`Error deleting image from Cloudinary: ${imageUrl}`, error)
    // Don't throw - deletion failure shouldn't break product updates
    return false
  }
}

/**
 * Check if image URL is a Cloudinary URL
 * @param {string} imageUrl - Image URL to check
 * @returns {boolean} - True if Cloudinary URL
 */
const isCloudinaryUrl = (imageUrl) => {
  if (!imageUrl || typeof imageUrl !== 'string') {
    return false
  }
  return imageUrl.includes('cloudinary.com')
}

/**
 * Check if Cloudinary is configured
 * @returns {boolean} - True if Cloudinary credentials are set
 */
const isConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  )
}

module.exports = {
  uploadImage,
  deleteImage,
  isCloudinaryUrl,
  isConfigured
}
