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
    if (featured === 'true') {
      query.featured = true
    }

    // Price range filter
    if (minPrice || maxPrice) {
      query.price = {}
      if (minPrice) query.price.$gte = parseFloat(minPrice)
      if (maxPrice) query.price.$lte = parseFloat(maxPrice)
    }

    // Search filter
    if (search) {
      query.$text = { $search: search }
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

    // Execute query
    const products = await Product.find(query)
      .select('-__v')
      .sort(sortOption)
      .skip(skip)
      .limit(limitNum)
      .lean()

    // Get total count for pagination
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
    const product = await Product.create(req.body)

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

    const product = await Product.findByIdAndUpdate(
      id,
      req.body,
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

    // Soft delete - set active to false
    product.active = false
    await product.save()

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

    // TODO: Implement Review model and populate reviews
    // For now, return empty array
    res.json({
      success: true,
      data: {
        reviews: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0
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

