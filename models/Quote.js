const mongoose = require('mongoose')

const quoteSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true,
    maxlength: [20, 'Phone number cannot exceed 20 characters']
  },
  location: {
    type: String,
    required: [true, 'Please provide your location'],
    trim: true,
    maxlength: [200, 'Location cannot exceed 200 characters']
  },
  systemSize: {
    type: String,
    trim: true,
    maxlength: [100, 'System size cannot exceed 100 characters']
  },
  installationDate: {
    type: String,
    trim: true,
    maxlength: [50, 'Installation date cannot exceed 50 characters']
  },
  contact: {
    type: String,
    required: [true, 'Please provide contact information (email or phone)'],
    trim: true
  },
  type: {
    type: String,
    enum: ['residential', 'commercial', 'industrial', 'consultation'],
    default: 'consultation'
  },
  status: {
    type: String,
    enum: ['pending', 'contacted', 'quoted', 'closed'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true
})

// Indexes
quoteSchema.index({ status: 1 })
quoteSchema.index({ createdAt: -1 })
quoteSchema.index({ contact: 1 })

module.exports = mongoose.model('Quote', quoteSchema)

