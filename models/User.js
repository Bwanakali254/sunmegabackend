const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'First name cannot be more than 50 characters']
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Last name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: true,
    unique: true,
    sparse: true, // Allows multiple null values but enforces uniqueness for non-null values
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  phone: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    minlength: [8, 'Password must be at least 8 characters'],
    select: false, // Don't return password by default
    required: function() {
      return this.provider === 'local'
    }
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'facebook'],
    default: 'local'
  },
  providerId: {
    type: String,
    sparse: true // Allows multiple null values but enforces uniqueness for non-null values
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  passwordResetToken: String,
  passwordResetExpires: Date,
  addresses: [{
    type: {
      type: String,
      enum: ['home', 'work', 'other'],
      default: 'home'
    },
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: {
      type: String,
      default: 'Kenya'
    },
    isDefault: {
      type: Boolean,
      default: false
    }
  }]
}, {
  timestamps: true
})

// Hash password before saving (only for local auth)
userSchema.pre('save', async function(next) {
  // Skip password hashing for OAuth users or if password is not modified
  if (!this.isModified('password') || this.provider !== 'local' || !this.password) {
    return next()
  }

  const salt = await bcrypt.genSalt(parseInt(process.env.BCRYPT_ROUNDS) || 12)
  this.password = await bcrypt.hash(this.password, salt)
  next()
})

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password)
}

module.exports = mongoose.model('User', userSchema)

