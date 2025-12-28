const Product = require('../models/Product')
const logger = require('../utils/logger')

/**
 * @desc    Get all products with filtering, search, and pagination
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const {
      category,
      search,
      featured,
      minPrice,
      maxPrice,
      sort,
      page = 1,
      limit = 12
    } = req.query

    // Build query
    const query = { active: true }

    // Category filter
    if (category && category !== 'All Products') {
      query.category = category
    }

    // Featured filter
    if (featured === 'true' || featured === true) {
      query.featured = true
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = parseFloat(minPrice)
      if (maxPrice) query.price.$lte = parseFloat(maxPrice)
    }

    // Search filter - use regex for reliable search (works without text index)
    if (search && search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
        { shortDescription: { $regex: search.trim(), $options: 'i' } }
      ]
    }

    // Sort options
    let sortOption = {}
    switch (sort) {
      case 'price-low':
        sortOption = { price: 1 }
        break
      case 'price-high':
        sortOption = { price: -1 }
        break
      case 'rating':
        sortOption = { rating: -1, reviewCount: -1 }
        break
      case 'newest':
        sortOption = { createdAt: -1 }
        break
      case 'name':
        sortOption = { name: 1 }
        break
      default:
        sortOption = { featured: -1, createdAt: -1 }
    }

    // Pagination
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    // Execute query with error handling
    let products = []
    let total = 0
    
    try {
      products = await Product.find(query)
        .select('-__v')
        .sort(sortOption)
        .skip(skip)
        .limit(limitNum)
        .lean()

      // Get total count for pagination
      total = await Product.countDocuments(query)
    } catch (error) {
      // If query fails (e.g., text index issue), log and return empty results
      logger.error('Product query error:', error)
      products = []
      total = 0
    }

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get single product by ID or slug
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProduct = async (req, res, next) => {
  try {
    const { id } = req.params

    // Try to find by ID first, then by slug
    let product = await Product.findOne({
      $or: [
        { _id: id },
        { slug: id }
      ],
      active: true
    }).select('-__v')

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    res.json({
      success: true,
      data: {
        product
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get products by category
 * @route   GET /api/products/category/:category
 * @access  Public
 */
const getProductsByCategory = async (req, res, next) => {
  try {
    const { category } = req.params
    const { page = 1, limit = 12 } = req.query

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const query = {
      category,
      active: true
    }

    const products = await Product.find(query)
      .select('-__v')
      .sort({ featured: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Product.countDocuments(query)

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Search products
 * @route   GET /api/products/search
 * @access  Public
 */
const searchProducts = async (req, res, next) => {
  try {
    const { q, page = 1, limit = 12 } = req.query

    if (!q || q.trim() === '') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Search query is required',
          code: 'SEARCH_QUERY_REQUIRED'
        }
      })
    }

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const skip = (pageNum - 1) * limitNum

    const query = {
      $text: { $search: q },
      active: true
    }

    const products = await Product.find(query)
      .select('-__v')
      .sort({ score: { $meta: 'textScore' } })
      .skip(skip)
      .limit(limitNum)
      .lean()

    const total = await Product.countDocuments(query)

    res.json({
      success: true,
      data: {
        products,
        query: q,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get featured products
 * @route   GET /api/products/featured
 * @access  Public
 */
const getFeaturedProducts = async (req, res, next) => {
  try {
    const { limit = 8 } = req.query
    const limitNum = parseInt(limit)

    const products = await Product.find({
      featured: true,
      active: true
    })
      .select('-__v')
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean()

    res.json({
      success: true,
      data: {
        products
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Create product (Admin only)
 * @route   POST /api/products
 * @access  Private/Admin
 */
const createProduct = async (req, res, next) => {
  try {
    const { getFileUrl } = require('../middleware/upload')
    
    // Handle uploaded images
    let images = []
    if (req.files && req.files.length > 0) {
      images = req.files.map(file => getFileUrl(file.filename))
    } else if (req.body.images) {
      // If images provided as URLs (from frontend)
      images = Array.isArray(req.body.images) ? req.body.images : [req.body.images]
    }
    
    // Validate that at least one image is provided
    if (images.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'At least one image is required',
          code: 'IMAGE_REQUIRED'
        }
      })
    }
    
    const productData = {
      ...req.body,
      images: images
    }
    
    const product = await Product.create(productData)

    res.status(201).json({
      success: true,
      data: {
        product
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Update product (Admin only)
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.params
    const { getFileUrl } = require('../middleware/upload')
    
    // Handle uploaded images
    let updateData = { ...req.body }
    if (req.files && req.files.length > 0) {
      const uploadedImages = req.files.map(file => getFileUrl(file.filename))
      // Merge with existing images if provided
      if (req.body.images) {
        const existingImages = Array.isArray(req.body.images) ? req.body.images : [req.body.images]
        updateData.images = [...existingImages, ...uploadedImages]
      } else {
        updateData.images = uploadedImages
      }
    }

    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-__v')

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    res.json({
      success: true,
      data: {
        product
      }
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Delete product (Admin only)
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
const deleteProduct = async (req, res, next) => {
  try {
    const { id } = req.params

    const product = await Product.findById(id)

    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    // Actually delete the product from database
    await Product.findByIdAndDelete(id)

    res.json({
      success: true,
      message: 'Product deleted successfully'
    })
  } catch (error) {
    next(error)
  }
}

/**
 * @desc    Get product reviews
 * @route   GET /api/products/:id/reviews
 * @access  Public
 */
const getProductReviews = async (req, res, next) => {
  try {
    const { id } = req.params
    const { page = 1, limit = 10 } = req.query

    const product = await Product.findById(id)
    if (!product) {
      return res.status(404).json({
        success: false,
        error: {
          message: 'Product not found',
          code: 'PRODUCT_NOT_FOUND'
        }
      })
    }

    const Review = require('../models/Review')
    const skip = (parseInt(page) - 1) * parseInt(limit)

    const [reviews, total] = await Promise.all([
      Review.find({
        productId: req.params.id,
        status: 'approved'
      })
        .populate('userId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Review.countDocuments({
        productId: req.params.id,
        status: 'approved'
      })
    ])

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  getProducts,
  getProduct,
  getProductsByCategory,
  searchProducts,
  getFeaturedProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductReviews
}

