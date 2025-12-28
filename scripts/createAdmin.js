const mongoose = require('mongoose')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const User = require('../models/User')

async function createAdmin() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    // Get admin details from command line arguments or use defaults
    const email = process.argv[2] || 'admin@sunmega.com'
    const password = process.argv[3] || 'Admin123!'
    const firstName = process.argv[4] || 'Admin'
    const lastName = process.argv[5] || 'User'

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email })
    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log(`\n⚠️  Admin user already exists with email: ${email}`)
        console.log('   Role: admin')
        console.log('   You can login with this account.')
        process.exit(0)
      } else {
        // Update existing user to admin
        existingAdmin.role = 'admin'
        existingAdmin.emailVerified = true
        await existingAdmin.save()
        console.log(`\n✅ Updated existing user to admin: ${email}`)
        console.log('   You can now login with this account.')
        process.exit(0)
      }
    }

    // Create new admin user
    const admin = await User.create({
      firstName,
      lastName,
      email,
      password,
      role: 'admin',
      emailVerified: true // Auto-verify admin email
    })

    console.log(`\n✅ Admin user created successfully!`)
    console.log(`\n📧 Email: ${email}`)
    console.log(`🔑 Password: ${password}`)
    console.log(`\n⚠️  Please change the password after first login!`)
    console.log(`\n🌐 Admin Panel URL: http://localhost:5173/admin`)
    console.log(`\n   Login at: http://localhost:5173/login`)

    process.exit(0)
  } catch (error) {
    console.error('❌ Error creating admin:', error.message)
    if (error.code === 11000) {
      console.error('   Email already exists. Use a different email or update existing user.')
    }
    process.exit(1)
  } finally {
    await mongoose.connection.close()
    console.log('\nDatabase connection closed')
  }
}

// Run the function
createAdmin()

