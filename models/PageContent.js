const mongoose = require('mongoose')

const pageContentSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    enum: ['home', 'products', 'about', 'contact', 'privacy-policy', 'terms-of-service']
  },
  hero: {
    title: {
      type: String,
      trim: true
    },
    subtitle: {
      type: String,
      trim: true
    },
    image: {
      type: String,
      trim: true
    }
  },
  sections: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
})

// Index for faster queries
pageContentSchema.index({ slug: 1 })

const PageContent = mongoose.model('PageContent', pageContentSchema)

module.exports = PageContent

