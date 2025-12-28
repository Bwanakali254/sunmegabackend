const Joi = require('joi')

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    // For multipart/form-data, combine body and files
    const dataToValidate = { ...req.body }
    
    // If files are uploaded, don't validate images field (it will be handled separately)
    if (req.files && req.files.length > 0) {
      // Remove images from validation if files are present
      delete dataToValidate.images
    }
    
    // Parse JSON strings (e.g., specifications from FormData)
    if (dataToValidate.specifications && typeof dataToValidate.specifications === 'string') {
      try {
        dataToValidate.specifications = JSON.parse(dataToValidate.specifications)
      } catch (e) {
        // If parsing fails, keep as is and let validation handle it
      }
    }
    
    // Convert string numbers to actual numbers for FormData
    if (dataToValidate.price && typeof dataToValidate.price === 'string') {
      dataToValidate.price = parseFloat(dataToValidate.price)
    }
    if (dataToValidate.compareAtPrice && typeof dataToValidate.compareAtPrice === 'string' && dataToValidate.compareAtPrice !== '') {
      dataToValidate.compareAtPrice = parseFloat(dataToValidate.compareAtPrice)
    }
    if (dataToValidate.stock !== undefined && typeof dataToValidate.stock === 'string') {
      dataToValidate.stock = parseInt(dataToValidate.stock)
    }
    
    // Convert string booleans
    if (dataToValidate.featured !== undefined && typeof dataToValidate.featured === 'string') {
      dataToValidate.featured = dataToValidate.featured === 'true' || dataToValidate.featured === '1'
    }
    if (dataToValidate.active !== undefined && typeof dataToValidate.active === 'string') {
      dataToValidate.active = dataToValidate.active === 'true' || dataToValidate.active === '1'
    }
    
    const { error, value } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    })

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))

      return res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          errors
        }
      })
    }

    req.body = value
    next()
  }
}

// Validation schemas
const schemas = {
  register: Joi.object({
    firstName: Joi.string().trim().min(1).max(50).required()
      .messages({
        'string.empty': 'First name is required',
        'string.max': 'First name cannot exceed 50 characters'
      }),
    lastName: Joi.string().trim().min(1).max(50).required()
      .messages({
        'string.empty': 'Last name is required',
        'string.max': 'Last name cannot exceed 50 characters'
      }),
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required'
      }),
    phone: Joi.string().trim().min(7).max(20).required()
      .messages({
        'string.empty': 'Phone number is required',
        'string.min': 'Phone number must be at least 7 digits',
        'string.max': 'Phone number cannot exceed 20 digits'
      }),
    password: Joi.string().min(8).max(128).required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password is too long',
        'string.empty': 'Password is required'
      })
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required'
      }),
    password: Joi.string().required()
      .messages({
        'string.empty': 'Password is required'
      })
  }),

  forgotPassword: Joi.object({
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required'
      })
  }),

  resetPassword: Joi.object({
    token: Joi.string().required()
      .messages({
        'string.empty': 'Reset token is required'
      }),
    password: Joi.string().min(8).max(128).required()
      .messages({
        'string.min': 'Password must be at least 8 characters',
        'string.max': 'Password is too long',
        'string.empty': 'Password is required'
      })
  }),

  updateProfile: Joi.object({
    firstName: Joi.string().trim().min(1).max(50),
    lastName: Joi.string().trim().min(1).max(50),
    phone: Joi.string().trim().min(7).max(20)
  }),

  changePassword: Joi.object({
    currentPassword: Joi.string().required()
      .messages({
        'string.empty': 'Current password is required'
      }),
    newPassword: Joi.string().min(8).max(128).required()
      .messages({
        'string.min': 'New password must be at least 8 characters',
        'string.max': 'New password is too long',
        'string.empty': 'New password is required'
      })
  }),

  createProduct: Joi.object({
    name: Joi.string().trim().min(1).max(200).required()
      .messages({
        'string.empty': 'Product name is required',
        'string.max': 'Product name cannot exceed 200 characters'
      }),
    description: Joi.string().trim().required()
      .messages({
        'string.empty': 'Product description is required'
      }),
    shortDescription: Joi.string().trim().max(500).allow(''),
    price: Joi.alternatives().try(
      Joi.number().min(0),
      Joi.string().pattern(/^\d+(\.\d+)?$/).custom((value) => parseFloat(value))
    ).required()
      .messages({
        'number.base': 'Price must be a number',
        'number.min': 'Price cannot be negative',
        'any.required': 'Price is required'
      }),
    compareAtPrice: Joi.alternatives().try(
      Joi.number().min(0),
      Joi.string().pattern(/^\d+(\.\d+)?$/).custom((value) => parseFloat(value)),
      Joi.string().allow('')
    ).optional(),
    category: Joi.string().valid('Batteries', 'Inverters', 'Energy Storage Systems', 'Converters', 'Controllers', 'Portable Power').required()
      .messages({
        'any.only': 'Invalid product category',
        'any.required': 'Category is required'
      }),
    images: Joi.alternatives().try(
      Joi.array().items(Joi.string()).min(1),
      Joi.string()
    ).optional(),
    specifications: Joi.object({
      power: Joi.string(),
      voltage: Joi.string(),
      capacity: Joi.string(),
      warranty: Joi.string(),
      dimensions: Joi.string(),
      weight: Joi.string(),
      efficiency: Joi.string(),
      temperatureRange: Joi.string()
    }),
    stock: Joi.alternatives().try(
      Joi.number().integer().min(0),
      Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
    ).optional().default(0),
    sku: Joi.string().trim().uppercase().allow(''),
    featured: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid('true', 'false', '1', '0').custom((value) => value === 'true' || value === '1')
    ).optional().default(false),
    active: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid('true', 'false', '1', '0').custom((value) => value === 'true' || value === '1')
    ).optional().default(true)
  }),

  updateProduct: Joi.object({
    name: Joi.string().trim().min(1).max(200),
    description: Joi.string().trim(),
    shortDescription: Joi.string().trim().max(500),
    price: Joi.number().min(0),
    compareAtPrice: Joi.number().min(0),
    category: Joi.string().valid('Batteries', 'Inverters', 'Energy Storage Systems', 'Converters', 'Controllers', 'Portable Power'),
    images: Joi.array().items(Joi.string()).min(1),
    specifications: Joi.object({
      power: Joi.string(),
      voltage: Joi.string(),
      capacity: Joi.string(),
      warranty: Joi.string(),
      dimensions: Joi.string(),
      weight: Joi.string(),
      efficiency: Joi.string(),
      temperatureRange: Joi.string()
    }),
    stock: Joi.number().integer().min(0),
    sku: Joi.string().trim().uppercase(),
    featured: Joi.boolean(),
    active: Joi.boolean()
  }),

  addToCart: Joi.object({
    productId: Joi.string().required()
      .messages({
        'string.empty': 'Product ID is required',
        'any.required': 'Product ID is required'
      }),
    quantity: Joi.number().integer().min(1).default(1)
      .messages({
        'number.base': 'Quantity must be a number',
        'number.min': 'Quantity must be at least 1'
      })
  }),

  updateCartItem: Joi.object({
    quantity: Joi.number().integer().min(1).required()
      .messages({
        'number.base': 'Quantity must be a number',
        'number.min': 'Quantity must be at least 1',
        'any.required': 'Quantity is required'
      })
  }),

  createOrder: Joi.object({
    shippingAddress: Joi.object({
      name: Joi.string().trim().required(),
      phone: Joi.string().trim().required(),
      email: Joi.string().email().lowercase().trim().required(),
      street: Joi.string().trim().required(),
      city: Joi.string().trim().required(),
      state: Joi.string().trim(),
      zipCode: Joi.string().trim(),
      country: Joi.string().trim().default('Kenya')
    }).required(),
    deliveryMethod: Joi.string().valid('home', 'pickup').default('home'),
    paymentMethod: Joi.string().valid('pesapal', 'mpesa', 'card', 'cash').required()
      .messages({
        'any.only': 'Invalid payment method',
        'any.required': 'Payment method is required'
      }),
    notes: Joi.string().trim().max(1000)
  }),

  updateOrderStatus: Joi.object({
    orderStatus: Joi.string().valid('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
    trackingNumber: Joi.string().trim()
  }),

  updatePaymentStatus: Joi.object({
    paymentStatus: Joi.string().valid('pending', 'processing', 'paid', 'failed', 'refunded'),
    paymentId: Joi.string().trim()
  }),

  initiatePayment: Joi.object({
    orderId: Joi.string().required()
      .messages({
        'string.empty': 'Order ID is required',
        'any.required': 'Order ID is required'
      })
  }),

  submitContact: Joi.object({
    name: Joi.string().trim().min(1).max(100).required()
      .messages({
        'string.empty': 'Name is required',
        'string.max': 'Name cannot exceed 100 characters',
        'any.required': 'Name is required'
      }),
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is required'
      }),
    phone: Joi.string().trim().max(20),
    subject: Joi.string().trim().min(1).max(200).required()
      .messages({
        'string.empty': 'Subject is required',
        'string.max': 'Subject cannot exceed 200 characters',
        'any.required': 'Subject is required'
      }),
    message: Joi.string().trim().min(1).max(2000).required()
      .messages({
        'string.empty': 'Message is required',
        'string.max': 'Message cannot exceed 2000 characters',
        'any.required': 'Message is required'
      })
  }),

  submitQuote: Joi.object({
    name: Joi.string().trim().max(100),
    email: Joi.string().email().lowercase().trim(),
    phone: Joi.string().trim().max(20),
    location: Joi.string().trim().min(1).max(200).required()
      .messages({
        'string.empty': 'Location is required',
        'string.max': 'Location cannot exceed 200 characters',
        'any.required': 'Location is required'
      }),
    systemSize: Joi.string().trim().max(100),
    installationDate: Joi.string().trim().max(50),
    contact: Joi.string().trim().min(1).required()
      .messages({
        'string.empty': 'Contact information (email or phone) is required',
        'any.required': 'Contact information is required'
      }),
    type: Joi.string().valid('residential', 'commercial', 'industrial', 'consultation')
  }),

  subscribeNewsletter: Joi.object({
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is required'
      })
  }),

  unsubscribeNewsletter: Joi.object({
    email: Joi.string().email().lowercase().trim().required()
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.empty': 'Email is required',
        'any.required': 'Email is required'
      })
  }),

  updateContactStatus: Joi.object({
    status: Joi.string().valid('new', 'read', 'replied').required()
  }),

  updateQuoteStatus: Joi.object({
    status: Joi.string().valid('pending', 'contacted', 'quoted', 'closed'),
    notes: Joi.string().trim().max(1000)
  }),

  createReview: Joi.object({
    productId: Joi.string().required()
      .messages({
        'string.empty': 'Product ID is required',
        'any.required': 'Product ID is required'
      }),
    rating: Joi.number().integer().min(1).max(5).required()
      .messages({
        'number.base': 'Rating must be a number',
        'number.min': 'Rating must be at least 1',
        'number.max': 'Rating cannot exceed 5',
        'any.required': 'Rating is required'
      }),
    title: Joi.string().trim().max(100).allow('')
      .messages({
        'string.max': 'Title cannot exceed 100 characters'
      }),
    comment: Joi.string().trim().max(1000).allow('')
      .messages({
        'string.max': 'Comment cannot exceed 1000 characters'
      })
  }),

  updateReview: Joi.object({
    rating: Joi.number().integer().min(1).max(5)
      .messages({
        'number.base': 'Rating must be a number',
        'number.min': 'Rating must be at least 1',
        'number.max': 'Rating cannot exceed 5'
      }),
    title: Joi.string().trim().max(100).allow('')
      .messages({
        'string.max': 'Title cannot exceed 100 characters'
      }),
    comment: Joi.string().trim().max(1000).allow('')
      .messages({
        'string.max': 'Comment cannot exceed 1000 characters'
      })
  }),

  createPage: Joi.object({
    slug: Joi.string().trim().lowercase().min(1).max(100).required()
      .pattern(/^[a-z0-9-]+$/)
      .messages({
        'string.empty': 'Slug is required',
        'string.max': 'Slug cannot exceed 100 characters',
        'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
      }),
    title: Joi.string().trim().min(1).max(200).required()
      .messages({
        'string.empty': 'Title is required',
        'string.max': 'Title cannot exceed 200 characters'
      }),
    metaDescription: Joi.string().trim().max(500).allow(''),
    sections: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('text', 'heading', 'image', 'list', 'quote').required(),
        content: Joi.string().trim().allow(''),
        imageUrl: Joi.string().uri().allow(''),
        order: Joi.number().integer().min(0).default(0)
      })
    ).default([]),
    heroImage: Joi.string().uri().allow(''),
    isActive: Joi.boolean().default(true)
  }),

  updatePage: Joi.object({
    slug: Joi.string().trim().lowercase().min(1).max(100)
      .pattern(/^[a-z0-9-]+$/)
      .messages({
        'string.max': 'Slug cannot exceed 100 characters',
        'string.pattern.base': 'Slug can only contain lowercase letters, numbers, and hyphens'
      }),
    title: Joi.string().trim().min(1).max(200)
      .messages({
        'string.max': 'Title cannot exceed 200 characters'
      }),
    metaDescription: Joi.string().trim().max(500).allow(''),
    sections: Joi.array().items(
      Joi.object({
        type: Joi.string().valid('text', 'heading', 'image', 'list', 'quote').required(),
        content: Joi.string().trim().allow(''),
        imageUrl: Joi.string().uri().allow(''),
        order: Joi.number().integer().min(0).default(0)
      })
    ),
    heroImage: Joi.string().uri().allow(''),
    isActive: Joi.boolean()
  })
}

module.exports = {
  validate,
  schemas
}

