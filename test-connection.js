/**
 * MongoDB Connection Test Script
 * Run this to verify your MongoDB connection is working
 * 
 * Usage: node test-connection.js
 */

require('dotenv').config()
const mongoose = require('mongoose')

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

console.log(`${colors.blue}Testing MongoDB Connection...${colors.reset}\n`)

// Check if MONGODB_URI is set
if (!process.env.MONGODB_URI) {
  console.error(`${colors.red}❌ Error: MONGODB_URI not found in .env file${colors.reset}`)
  console.log(`${colors.yellow}Please create .env file from .env.example and set MONGODB_URI${colors.reset}`)
  process.exit(1)
}

console.log(`${colors.blue}Connection String: ${process.env.MONGODB_URI.replace(/:[^:@]+@/, ':****@')}${colors.reset}\n`)

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log(`${colors.green}✅ MongoDB Connected Successfully!${colors.reset}`)
    console.log(`${colors.green}Database: ${mongoose.connection.name}${colors.reset}`)
    console.log(`${colors.green}Host: ${mongoose.connection.host}${colors.reset}`)
    console.log(`${colors.green}Port: ${mongoose.connection.port || 'N/A (Atlas)'}${colors.reset}`)
    console.log(`${colors.green}Ready State: ${mongoose.connection.readyState} (1 = Connected)${colors.reset}\n`)
    
    // Test a simple operation
    return mongoose.connection.db.admin().ping()
  })
  .then(() => {
    console.log(`${colors.green}✅ Ping successful - MongoDB is responding!${colors.reset}\n`)
    console.log(`${colors.green}🎉 Your MongoDB setup is working correctly!${colors.reset}`)
    process.exit(0)
  })
  .catch((error) => {
    console.error(`${colors.red}❌ MongoDB Connection Failed!${colors.reset}\n`)
    console.error(`${colors.red}Error: ${error.message}${colors.reset}\n`)
    
    // Provide helpful error messages
    if (error.message.includes('authentication failed')) {
      console.log(`${colors.yellow}💡 Tip: Check your username and password in the connection string${colors.reset}`)
      console.log(`${colors.yellow}   Make sure special characters are URL encoded${colors.reset}`)
    } else if (error.message.includes('IP')) {
      console.log(`${colors.yellow}💡 Tip: Add your IP address to MongoDB Atlas Network Access whitelist${colors.reset}`)
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log(`${colors.yellow}💡 Tip: Make sure MongoDB service is running (local) or cluster is active (Atlas)${colors.reset}`)
    } else if (error.message.includes('ENOTFOUND')) {
      console.log(`${colors.yellow}💡 Tip: Check your connection string format and cluster name${colors.reset}`)
    }
    
    console.log(`\n${colors.yellow}Check MONGODB_SETUP.md for detailed troubleshooting steps${colors.reset}`)
    process.exit(1)
  })

