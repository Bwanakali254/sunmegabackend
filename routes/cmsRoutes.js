const express = require('express')
const router = express.Router()
const { protect } = require('../middleware/auth')
const authorize = require('../middleware/authorize')
const { validate, schemas } = require('../middleware/validate')
const { uploadSingle } = require('../middleware/upload')
const {
  getPages,
  getPageBySlug,
  savePage,
  deletePage
} = require('../controllers/cmsController')

// Public route - get page by slug
router.get('/pages/:slug', getPageBySlug)

// Admin routes - require authentication and admin role
router.use(protect)
router.use(authorize('admin'))

// CMS Management
router.get('/pages', getPages)
router.post('/pages', uploadSingle('heroImage'), validate(schemas.createPage), savePage)
router.put('/pages/:id', uploadSingle('heroImage'), validate(schemas.updatePage), savePage)
router.delete('/pages/:id', deletePage)

module.exports = router

