const PageContent = require('../models/PageContent')
const logger = require('../utils/logger')
const { getFileUrl } = require('../middleware/upload')

/**
 * @desc    Get page content by slug (public)
 * @route   GET /api/pages/:slug
 * @access  Public
 */
const getPageContent = async (req, res, next) => {
  try {
    const { slug } = req.params
    
    // Validate slug
    const validSlugs = ['home', 'products', 'about', 'contact', 'privacy-policy', 'terms-of-service']
    if (!validSlugs.includes(slug.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid page slug',
          code: 'INVALID_SLUG'
        }
      })
    }
    
    const pageContent = await PageContent.findOne({ slug: slug.toLowerCase() })
    
    if (!pageContent) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Page content not found',
          code: 'PAGE_CONTENT_NOT_FOUND'
        }
      })
    }
    
    // Convert sections Map to object for JSON response
    const sectionsObject = {}
    if (pageContent.sections && pageContent.sections instanceof Map) {
      pageContent.sections.forEach((value, key) => {
        sectionsObject[key] = value
      })
    } else if (pageContent.sections && typeof pageContent.sections === 'object') {
      Object.assign(sectionsObject, pageContent.sections)
    }
    
    res.json({
      success: true,
      data: {
        pageContent: {
          slug: pageContent.slug,
          hero: pageContent.hero,
          sections: sectionsObject
        }
      }
    })
  } catch (error) {
    logger.error('Get page content error:', error)
    next(error)
  }
}

/**
 * @desc    Update page content by slug (admin only)
 * @route   PUT /api/admin/pages/:slug
 * @access  Private/Admin
 */
const updatePageContent = async (req, res, next) => {
  try {
    const { slug } = req.params
    
    // Validate slug
    const validSlugs = ['home', 'products', 'about', 'contact', 'privacy-policy', 'terms-of-service']
    if (!validSlugs.includes(slug.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Invalid page slug',
          code: 'INVALID_SLUG'
        }
      })
    }
    
    // Parse FormData fields (they come as strings like "hero[title]")
    let hero = {}
    if (req.body.hero) {
      // If hero is already an object (JSON request)
      hero = typeof req.body.hero === 'string' ? JSON.parse(req.body.hero) : req.body.hero
    } else {
      // Parse FormData format: hero[title], hero[subtitle], hero[image]
      hero = {
        title: req.body['hero[title]'] || '',
        subtitle: req.body['hero[subtitle]'] || '',
        image: req.body['hero[image]'] || ''
      }
    }
    
    // Parse sections from FormData (sections[key] format)
    let sections = {}
    if (req.body.sections && typeof req.body.sections === 'object' && !Array.isArray(req.body.sections)) {
      sections = req.body.sections
    } else {
      // Parse FormData format: sections[key1], sections[key2], etc.
      Object.keys(req.body).forEach(key => {
        if (key.startsWith('sections[') && key.endsWith(']')) {
          const sectionKey = key.slice(9, -1) // Extract key from "sections[key]"
          sections[sectionKey] = req.body[key] || ''
        }
      })
    }
    
    // Handle hero image upload
    let heroImageUrl = hero.image
    if (req.file) {
      heroImageUrl = getFileUrl(req.file.filename)
    }
    
    // Prepare hero data
    const heroData = {
      title: hero.title || '',
      subtitle: hero.subtitle || '',
      image: heroImageUrl || hero.image || ''
    }
    
    // Convert sections object to Map if provided
    let sectionsMap = new Map()
    if (sections && typeof sections === 'object') {
      Object.keys(sections).forEach(key => {
        if (sections[key] && typeof sections[key] === 'string') {
          sectionsMap.set(key, sections[key])
        }
      })
    }
    
    // Update or create page content
    const pageContent = await PageContent.findOneAndUpdate(
      { slug: slug.toLowerCase() },
      {
        hero: heroData,
        sections: sectionsMap
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    )
    
    // Convert sections Map to object for JSON response
    const sectionsObject = {}
    if (pageContent.sections && pageContent.sections instanceof Map) {
      pageContent.sections.forEach((value, key) => {
        sectionsObject[key] = value
      })
    } else if (pageContent.sections && typeof pageContent.sections === 'object') {
      Object.assign(sectionsObject, pageContent.sections)
    }
    
    res.json({
      success: true,
      data: {
        pageContent: {
          slug: pageContent.slug,
          hero: pageContent.hero,
          sections: sectionsObject
        }
      }
    })
  } catch (error) {
    logger.error('Update page content error:', error)
    next(error)
  }
}

module.exports = {
  getPageContent,
  updatePageContent
}

