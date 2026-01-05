const { v4: uuidv4 } = require('uuid')

/**
 * REQUEST ID MIDDLEWARE
 * 
 * Adds unique request ID to every request for tracing.
 * Request ID is available in req.requestId and response headers.
 */

const requestIdMiddleware = (req, res, next) => {
  // Use existing request ID from header, or generate new one
  const requestId = req.headers['x-request-id'] || uuidv4()
  
  // Attach to request object
  req.requestId = requestId
  
  // Add to response header
  res.setHeader('X-Request-ID', requestId)
  
  next()
}

module.exports = requestIdMiddleware
