const mongoose = require('mongoose')

const wishlistSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // One wishlist per user - unique: true automatically creates an index
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
// Note: userId index is automatically created by unique: true in the schema above
wishlistSchema.index({ 'items.productId': 1 })

module.exports = mongoose.model('Wishlist', wishlistSchema)

