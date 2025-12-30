/**
 * CMS Pages Initialization Script
 * 
 * Creates default CMS pages if they don't exist.
 * This is a one-time initialization script.
 * 
 * Run: node backend/scripts/initializeCmsPages.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const mongoose = require('mongoose')
const PageContent = require('../models/PageContent')

const requiredSlugs = ['home', 'products', 'about', 'contact']

async function initializeCmsPages() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI
    if (!mongoUri) {
      console.error('❌ MONGODB_URI environment variable is required')
      process.exit(1)
    }

    await mongoose.connect(mongoUri)
    console.log('✅ Connected to MongoDB')

    // Check and create missing pages
    let created = 0
    let existing = 0

    for (const slug of requiredSlugs) {
      const existingPage = await PageContent.findOne({ slug })
      
      if (existingPage) {
        console.log(`✓ Page "${slug}" already exists`)
        existing++
      } else {
        // Create minimal default structure
        await PageContent.create({
          slug,
          hero: {
            title: '',
            subtitle: '',
            image: ''
          },
          sections: new Map()
        })
        console.log(`✅ Created page "${slug}"`)
        created++
      }
    }

    console.log('\n📊 Summary:')
    console.log(`   Created: ${created}`)
    console.log(`   Existing: ${existing}`)
    console.log(`   Total: ${requiredSlugs.length}`)

    await mongoose.disconnect()
    console.log('\n✅ Initialization complete')
    process.exit(0)
  } catch (error) {
    console.error('❌ Error initializing CMS pages:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

initializeCmsPages()

