const mongoose = require('mongoose')

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One wishlist per user
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
})

// Indexes
wishlistSchema.index({ userId: 1 })
wishlistSchema.index({ 'items.productId': 1 })

module.exports = mongoose.model('Wishlist', wishlistSchema)

