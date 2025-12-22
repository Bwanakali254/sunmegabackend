// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Not authorized to access this route',
          code: 'UNAUTHORIZED'
        }
      })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          message: `User role '${req.user.role}' is not authorized to access this route`,
          code: 'FORBIDDEN'
        }
      })
    }

    next()
  }
}

module.exports = authorize

