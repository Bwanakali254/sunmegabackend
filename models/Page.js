const mongoose = require('mongoose')

const pageSectionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['text', 'heading', 'image', 'list', 'quote'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  imageUrl: String,
  order: {
    type: Number,
    default: 0
  }
})

const pageSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true, // unique: true automatically creates an index
    lowercase: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  metaDescription: {
    type: String,
    trim: true
  },
  sections: [pageSectionSchema],
  heroImage: String,
  isActive: {
    type: Boolean,
    default: true
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

// Indexes for faster queries
// Note: slug index is automatically created by unique: true above
pageSchema.index({ isActive: 1 })

const Page = mongoose.model('Page', pageSchema)

module.exports = Page

