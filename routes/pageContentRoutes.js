const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { uploadSingle } = require('../middleware/upload')
const {
  getPageContent,
  updatePageContent
} = require('../controllers/pageContentController')

// Public route - get page content by slug
router.get('/pages/:slug', getPageContent)

// Admin routes - require authentication and admin role
router.use(protect)
router.use(authorize('admin'))

// Update page content by slug
router.put('/pages/:slug', uploadSingle('heroImage'), updatePageContent)

module.exports = router

