const mongoose = require('mongoose')

const reviewSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  comment: {
    type: String,
    trim: true,
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  verified: {
    type: Boolean,
    default: false // Set to true if user purchased the product
  },
  helpful: {
    type: Number,
    default: 0,
    min: [0, 'Helpful count cannot be negative']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true
})

// Prevent duplicate reviews from same user for same product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true })

// Indexes for efficient queries
reviewSchema.index({ productId: 1, status: 1 })
reviewSchema.index({ userId: 1 })
reviewSchema.index({ createdAt: -1 })

module.exports = mongoose.model('Review', reviewSchema)

