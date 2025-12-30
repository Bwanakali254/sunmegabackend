/**
 * READ-ONLY DATABASE AUDIT SCRIPT
 * 
 * Scans database for absolute URLs that need normalization to relative paths.
 * 
 * CONTRACT: Database must store ONLY relative paths (/uploads/...)
 * 
 * This script:
 * - Reads from database (READ-ONLY)
 * - Reports findings
 * - Does NOT modify any data
 */

require('dotenv').config()
const mongoose = require('mongoose')
const Product = require('../models/Product')
const Page = require('../models/Page')

// Helper to detect absolute URLs
const isAbsoluteUrl = (url) => {
  if (!url || typeof url !== 'string') return false
  return url.startsWith('http://') || url.startsWith('https://')
}

// Helper to extract relative path from absolute URL
const normalizeToRelativePath = (absoluteUrl) => {
  if (!isAbsoluteUrl(absoluteUrl)) return null
  
  // Extract path after domain
  try {
    const url = new URL(absoluteUrl)
    const path = url.pathname
    
    // If path starts with /uploads/, return as-is
    if (path.startsWith('/uploads/')) {
      return path
    }
    
    // If path contains uploads, extract from there
    const uploadsIndex = path.indexOf('/uploads/')
    if (uploadsIndex !== -1) {
      return path.substring(uploadsIndex)
    }
    
    // If it's a full URL to uploads, construct relative path
    if (absoluteUrl.includes('/uploads/')) {
      const parts = absoluteUrl.split('/uploads/')
      if (parts.length > 1) {
        return `/uploads/${parts[1]}`
      }
    }
    
    return null
  } catch (e) {
    return null
  }
}

// Helper to detect localhost or backend domain URLs
const isBackendUrl = (url) => {
  if (!isAbsoluteUrl(url)) return false
  
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname
    
    // Check for localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true
    }
    
    // Check for known backend domains
    const backendDomains = [
      'sunmegalimited.onrender.com',
      'localhost:5000',
      '127.0.0.1:5000'
    ]
    
    return backendDomains.some(domain => hostname.includes(domain))
  } catch (e) {
    return false
  }
}

// Audit Products
const auditProducts = async () => {
  console.log('\n📦 AUDITING PRODUCTS COLLECTION...\n')
  
  const products = await Product.find({}).lean()
  const violations = []
  
  products.forEach(product => {
    if (!product.images || !Array.isArray(product.images)) return
    
    product.images.forEach((imageUrl, index) => {
      if (isAbsoluteUrl(imageUrl)) {
        const normalized = normalizeToRelativePath(imageUrl)
        const isBackend = isBackendUrl(imageUrl)
        
        violations.push({
          collection: 'products',
          documentId: product._id.toString(),
          documentName: product.name,
          field: `images[${index}]`,
          currentValue: imageUrl,
          proposedValue: normalized || '⚠️  CANNOT NORMALIZE - MANUAL REVIEW REQUIRED',
          isBackendUrl: isBackend,
          isLocalhost: imageUrl.includes('localhost')
        })
      }
    })
  })
  
  return violations
}

// Audit CMS Pages
const auditPages = async () => {
  console.log('\n📄 AUDITING PAGES COLLECTION...\n')
  
  const pages = await Page.find({}).lean()
  const violations = []
  
  pages.forEach(page => {
    // Check heroImage
    if (page.heroImage && isAbsoluteUrl(page.heroImage)) {
      const normalized = normalizeToRelativePath(page.heroImage)
      const isBackend = isBackendUrl(page.heroImage)
      
      violations.push({
        collection: 'pages',
        documentId: page._id.toString(),
        documentName: page.title || page.slug,
        field: 'heroImage',
        currentValue: page.heroImage,
        proposedValue: normalized || '⚠️  CANNOT NORMALIZE - MANUAL REVIEW REQUIRED',
        isBackendUrl: isBackend,
        isLocalhost: page.heroImage.includes('localhost')
      })
    }
    
    // Check sections[].imageUrl
    if (page.sections && Array.isArray(page.sections)) {
      page.sections.forEach((section, sectionIndex) => {
        if (section.imageUrl && isAbsoluteUrl(section.imageUrl)) {
          const normalized = normalizeToRelativePath(section.imageUrl)
          const isBackend = isBackendUrl(section.imageUrl)
          
          violations.push({
            collection: 'pages',
            documentId: page._id.toString(),
            documentName: page.title || page.slug,
            field: `sections[${sectionIndex}].imageUrl`,
            currentValue: section.imageUrl,
            proposedValue: normalized || '⚠️  CANNOT NORMALIZE - MANUAL REVIEW REQUIRED',
            isBackendUrl: isBackend,
            isLocalhost: section.imageUrl.includes('localhost')
          })
        }
      })
    }
  })
  
  return violations
}

// Main audit function
const runAudit = async () => {
  try {
    console.log('🔍 PHASE 2 — DATA NORMALIZATION AUDIT (READ-ONLY)')
    console.log('=' .repeat(60))
    console.log('\n⚠️  READ-ONLY MODE: No data will be modified\n')
    
    // Connect to database
    if (!process.env.MONGODB_URI) {
      console.error('❌ MONGODB_URI not set in environment')
      process.exit(1)
    }
    
    console.log('Connecting to database...')
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('✅ Connected to database\n')
    
    // Run audits
    const productViolations = await auditProducts()
    const pageViolations = await auditPages()
    
    // Generate summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 AUDIT SUMMARY')
    console.log('='.repeat(60))
    console.log(`\nProducts Collection:`)
    console.log(`  Total products scanned: ${await Product.countDocuments()}`)
    console.log(`  Products with absolute URLs: ${new Set(productViolations.map(v => v.documentId)).size}`)
    console.log(`  Total absolute URL violations: ${productViolations.length}`)
    console.log(`  Localhost URLs: ${productViolations.filter(v => v.isLocalhost).length}`)
    console.log(`  Backend domain URLs: ${productViolations.filter(v => v.isBackendUrl).length}`)
    
    console.log(`\nPages Collection:`)
    console.log(`  Total pages scanned: ${await Page.countDocuments()}`)
    console.log(`  Pages with absolute URLs: ${new Set(pageViolations.map(v => v.documentId)).size}`)
    console.log(`  Total absolute URL violations: ${pageViolations.length}`)
    console.log(`  Localhost URLs: ${pageViolations.filter(v => v.isLocalhost).length}`)
    console.log(`  Backend domain URLs: ${pageViolations.filter(v => v.isBackendUrl).length}`)
    
    const totalViolations = productViolations.length + pageViolations.length
    console.log(`\n📋 TOTAL VIOLATIONS: ${totalViolations}`)
    
    // Detailed report
    if (totalViolations > 0) {
      console.log('\n' + '='.repeat(60))
      console.log('📋 DETAILED VIOLATIONS REPORT')
      console.log('='.repeat(60))
      
      // Products violations
      if (productViolations.length > 0) {
        console.log('\n📦 PRODUCTS COLLECTION VIOLATIONS:\n')
        productViolations.forEach((violation, index) => {
          console.log(`${index + 1}. Document: ${violation.documentName} (${violation.documentId})`)
          console.log(`   Field: ${violation.field}`)
          console.log(`   Current: ${violation.currentValue}`)
          console.log(`   Proposed: ${violation.proposedValue}`)
          console.log(`   Type: ${violation.isLocalhost ? 'localhost' : violation.isBackendUrl ? 'backend domain' : 'external'}`)
          console.log('')
        })
      }
      
      // Pages violations
      if (pageViolations.length > 0) {
        console.log('\n📄 PAGES COLLECTION VIOLATIONS:\n')
        pageViolations.forEach((violation, index) => {
          console.log(`${index + 1}. Document: ${violation.documentName} (${violation.documentId})`)
          console.log(`   Field: ${violation.field}`)
          console.log(`   Current: ${violation.currentValue}`)
          console.log(`   Proposed: ${violation.proposedValue}`)
          console.log(`   Type: ${violation.isLocalhost ? 'localhost' : violation.isBackendUrl ? 'backend domain' : 'external'}`)
          console.log('')
        })
      }
    } else {
      console.log('\n✅ NO VIOLATIONS FOUND - Database is contract compliant!')
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ READ-ONLY AUDIT COMPLETE')
    console.log('='.repeat(60))
    console.log('\n⚠️  No data was modified during this audit.\n')
    
    // Close connection
    await mongoose.connection.close()
    process.exit(0)
    
  } catch (error) {
    console.error('\n❌ Audit error:', error)
    await mongoose.connection.close()
    process.exit(1)
  }
}

// Run audit
runAudit()

