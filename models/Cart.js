const mongoose = require('mongoose')

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1']
    },
    price: {
      type: Number,
      required: true,
      min: [0, 'Price cannot be negative']
    }
  }]
}, {
  timestamps: true
})

// Calculate total before saving
cartSchema.methods.calculateTotal = function() {
  return this.items.reduce((total, item) => {
    return total + (item.price * item.quantity)
  }, 0)
}

// Virtual for total
cartSchema.virtual('total').get(function() {
  return this.calculateTotal()
})

// Ensure virtuals are included in JSON
cartSchema.set('toJSON', { virtuals: true })

module.exports = mongoose.model('Cart', cartSchema)

