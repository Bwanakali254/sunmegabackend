const Joi = require('joi')

// Validation middleware factory
const validate = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
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
    shortDescription: Joi.string().trim().max(500),
    price: Joi.number().min(0).required()
      .messages({
        'number.base': 'Price must be a number',
        'number.min': 'Price cannot be negative',
        'any.required': 'Price is required'
      }),
    compareAtPrice: Joi.number().min(0),
    category: Joi.string().valid('Batteries', 'Inverters', 'Energy Storage Systems', 'Converters', 'Controllers', 'Portable Power').required()
      .messages({
        'any.only': 'Invalid product category',
        'any.required': 'Category is required'
      }),
    images: Joi.array().items(Joi.string()).min(1).required()
      .messages({
        'array.min': 'At least one image is required',
        'any.required': 'Images are required'
      }),
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
    stock: Joi.number().integer().min(0).default(0),
    sku: Joi.string().trim().uppercase(),
    featured: Joi.boolean().default(false),
    active: Joi.boolean().default(true)
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
  })
}

module.exports = {
  validate,
  schemas
}

