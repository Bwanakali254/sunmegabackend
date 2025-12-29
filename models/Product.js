const mongoose = require('mongoose')

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a product name'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true, // unique: true automatically creates an index
    lowercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Please provide a product description'],
    trim: true
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Please provide a product price'],
    min: [0, 'Price cannot be negative']
  },
  compareAtPrice: {
    type: Number,
    min: [0, 'Compare at price cannot be negative']
  },
  category: {
    type: String,
    required: [true, 'Please provide a product category'],
    enum: {
      values: ['Batteries', 'Inverters', 'Energy Storage Systems', 'Converters', 'Controllers', 'Portable Power'],
      message: 'Invalid product category'
    }
  },
  images: {
    type: [String],
    required: [true, 'Please provide at least one product image'],
    validate: {
      validator: function(v) {
        return v && v.length > 0
      },
      message: 'At least one image is required'
    }
  },
  specifications: {
    power: String,
    voltage: String,
    capacity: String,
    warranty: String,
    dimensions: String,
    weight: String,
    efficiency: String,
    temperatureRange: String
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative']
  },
  sku: {
    type: String,
    unique: true,
    sparse: true, // Allow null/undefined but enforce uniqueness when present
    trim: true,
    uppercase: true
  },
  rating: {
    type: Number,
    default: 0,
    min: [0, 'Rating cannot be negative'],
    max: [5, 'Rating cannot exceed 5']
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: [0, 'Review count cannot be negative']
  },
  featured: {
    type: Boolean,
    default: false
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Create index for search
productSchema.index({ name: 'text', description: 'text', shortDescription: 'text' })
productSchema.index({ category: 1 })
productSchema.index({ featured: 1 })
productSchema.index({ active: 1 })
productSchema.index({ price: 1 })
productSchema.index({ rating: -1 })

// Note: slug index is automatically created by unique: true above

// Note: Slug generation is now handled in the controller using utils/slugify.js
// This ensures uniqueness and proper server-side generation
// The pre-save hook is kept as a fallback but controller logic takes precedence

module.exports = mongoose.model('Product', productSchema)

