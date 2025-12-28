const Page = require('../models/Page')
const logger = require('../utils/logger')
const { getFileUrl } = require('../middleware/upload')
const mongoose = require('mongoose')

/**
 * @desc    Get all pages
 * @route   GET /api/admin/cms/pages
 * @access  Private/Admin
 */
const getPages = async (req, res, next) => {
  try {
    const pages = await Page.find().sort({ createdAt: -1 })
    
    res.json({
      success: true,
      data: {
        pages
      }
    })
  } catch (error) {
    logger.error('Get pages error:', error)
    next(error)
  }
}

/**
 * @desc    Get single page by slug
 * @route   GET /api/cms/pages/:slug
 * @access  Public
 */
const getPageBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params
    
    const page = await Page.findOne({ slug, isActive: true })
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Page not found',
          code: 'PAGE_NOT_FOUND'
        }
      })
    }
    
    res.json({
      success: true,
      data: {
        page
      }
    })
  } catch (error) {
    logger.error('Get page by slug error:', error)
    next(error)
  }
}

/**
 * @desc    Create or update page
 * @route   POST /api/admin/cms/pages
 * @route   PUT /api/admin/cms/pages/:id
 * @access  Private/Admin
 */
const savePage = async (req, res, next) => {
  try {
    let { slug, title, metaDescription, sections, heroImage, isActive } = req.body
    
    // Parse sections if it's a string (from FormData)
    if (typeof sections === 'string') {
      try {
        sections = JSON.parse(sections)
      } catch (e) {
        sections = []
      }
    }
    
    // Handle hero image upload
    let heroImageUrl = heroImage
    if (req.file) {
      heroImageUrl = getFileUrl(req.file.filename)
    }
    
    // Process sections
    const processedSections = (sections || []).map((section, index) => {
      return {
        type: section.type || 'text',
        content: section.content || '',
        imageUrl: section.imageUrl || '',
        order: section.order !== undefined ? section.order : index
      }
    })
    
    let page
    if (req.params.id) {
      // Update existing page
      page = await Page.findByIdAndUpdate(
        req.params.id,
        {
          slug,
          title,
          metaDescription,
          sections: processedSections,
          heroImage: heroImageUrl || heroImage,
          isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
          lastModifiedBy: new mongoose.Types.ObjectId(req.user.id)
        },
        { new: true, runValidators: true }
      )
      
      if (!page) {
        return res.status(404).json({
          success: false,
          error: {
            message: 'Page not found',
            code: 'PAGE_NOT_FOUND'
          }
        })
      }
    } else {
      // Create new page
      page = await Page.create({
        slug,
        title,
        metaDescription,
        sections: processedSections,
        heroImage: heroImageUrl,
        isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : true,
        lastModifiedBy: new mongoose.Types.ObjectId(req.user.id)
      })
    }
    
    res.json({
      success: true,
      data: {
        page
      }
    })
  } catch (error) {
    logger.error('Save page error:', error)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Page with this slug already exists',
          code: 'DUPLICATE_SLUG'
        }
      })
    }
    next(error)
  }
}

/**
 * @desc    Delete page
 * @route   DELETE /api/admin/cms/pages/:id
 * @access  Private/Admin
 */
const deletePage = async (req, res, next) => {
  try {
    const page = await Page.findByIdAndDelete(req.params.id)
    
    if (!page) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Page not found',
          code: 'PAGE_NOT_FOUND'
        }
      })
    }
    
    res.json({
      success: true,
      message: 'Page deleted successfully'
    })
  } catch (error) {
    logger.error('Delete page error:', error)
    next(error)
  }
}

module.exports = {
  getPages,
  getPageBySlug,
  savePage,
  deletePage
}

