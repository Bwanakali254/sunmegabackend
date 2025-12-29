const Product = require('../models/Product')

/**
 * Generate a URL-safe slug from a string
 * @param {string} text - Text to convert to slug
 * @returns {string} - URL-safe slug
 */
function generateSlug(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  return text
    .toLowerCase()
    .trim()
    // Replace spaces and special characters with hyphens
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, '')
}

/**
 * Generate a unique slug by checking for existing slugs
 * If slug exists, append a numeric suffix (e.g., -2, -3)
 * @param {string} baseSlug - Base slug to make unique
 * @param {string} excludeId - Product ID to exclude from uniqueness check (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateUniqueSlug(baseSlug, excludeId = null) {
  if (!baseSlug) {
    throw new Error('Base slug is required')
  }

  let slug = baseSlug
  let counter = 1
  const maxAttempts = 100 // Prevent infinite loops

  // Build query to check for existing slug
  const query = { slug }
  if (excludeId) {
    query._id = { $ne: excludeId }
  }

  // Check if slug exists and increment counter until unique
  while (counter < maxAttempts) {
    const existing = await Product.findOne(query)
    
    if (!existing) {
      return slug
    }

    // Slug exists, append counter
    counter++
    slug = `${baseSlug}-${counter}`
    query.slug = slug
  }

  // Fallback: append timestamp if max attempts reached
  return `${baseSlug}-${Date.now()}`
}

/**
 * Generate slug from product name and ensure uniqueness
 * @param {string} productName - Product name
 * @param {string} excludeId - Product ID to exclude (for updates)
 * @returns {Promise<string>} - Unique slug
 */
async function generateProductSlug(productName, excludeId = null) {
  if (!productName || typeof productName !== 'string' || !productName.trim()) {
    throw new Error('Product name is required to generate slug')
  }

  // Sanitize and generate base slug
  const baseSlug = generateSlug(productName.trim())
  
  if (!baseSlug) {
    throw new Error('Unable to generate slug from product name')
  }

  // Ensure uniqueness
  return await generateUniqueSlug(baseSlug, excludeId)
}

module.exports = {
  generateSlug,
  generateUniqueSlug,
  generateProductSlug
}

