/**
 * MongoDB Connection Test Script
 * 
 * Run this to verify your MongoDB connection before starting the server:
 * node scripts/test-connection.js
 */

require('dotenv').config()
const mongoose = require('mongoose')

async function testConnection() {
  console.log('\n🔍 Testing MongoDB Connection...\n')

  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.error('❌ ERROR: MONGODB_URI is not defined in .env file')
    console.error('\n📝 Please add this to your backend/.env file:')
    console.error('MONGODB_URI=mongodb+srv://<username>:<password>@sunmega-db.4v1svbt.mongodb.net/sunmega?retryWrites=true&w=majority\n')
    process.exit(1)
  }

  // Mask password in URI for logging
  const maskedUri = process.env.MONGODB_URI.replace(/:([^:@]+)@/, ':****@')
  console.log(`📋 Connection String: ${maskedUri}\n`)

  try {
    console.log('⏳ Attempting connection...')
    
    const conn = await mongoose.connect(process.env.MONGODB_URI)

    console.log('✅ MongoDB Connected Successfully!')
    console.log(`   Host: ${conn.connection.host}`)
    console.log(`   Database: ${conn.connection.name}`)
    console.log(`   Ready State: ${conn.connection.readyState === 1 ? 'Connected' : 'Disconnected'}\n`)

    // Test a simple query
    try {
      const collections = await conn.connection.db.listCollections().toArray()
      console.log(`📦 Collections found: ${collections.length}`)
      if (collections.length > 0) {
        console.log('   Collections:', collections.map(c => c.name).join(', '))
      }
    } catch (err) {
      console.log('⚠️  Could not list collections (this is OK if database is new)')
    }

    await mongoose.connection.close()
    console.log('\n✅ Connection test passed! You can start your server now.\n')
    process.exit(0)
  } catch (error) {
    console.error('\n❌ MongoDB Connection Failed!\n')
    console.error(`Error: ${error.message}\n`)

    // Provide specific guidance based on error
    if (error.message.includes('ETIMEOUT') || error.message.includes('queryTxt')) {
      console.error('🔧 DNS/Network Timeout Detected:')
      console.error('   1. Check MongoDB Atlas → Network Access → IP Access List')
      console.error('      Add: 0.0.0.0/0 (for development)')
      console.error('   2. Check your internet connection')
      console.error('   3. On Windows, run: ipconfig /flushdns')
      console.error('   4. On Mac, run: sudo dscacheutil -flushcache\n')
    } else if (error.message.includes('authentication failed') || error.message.includes('bad auth')) {
      console.error('🔧 Authentication Failed:')
      console.error('   1. Verify username and password in MONGODB_URI')
      console.error('   2. Ensure special characters are URL-encoded')
      console.error('   3. Check MongoDB Atlas → Database Access → Users\n')
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('🔧 DNS Resolution Failed:')
      console.error('   1. Check if the MongoDB hostname is correct')
      console.error('   2. Try: ipconfig /flushdns (Windows) or sudo dscacheutil -flushcache (Mac)\n')
    }

    process.exit(1)
  }
}

testConnection()
