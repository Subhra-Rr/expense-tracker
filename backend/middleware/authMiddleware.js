const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const User = require('../models/User')
const { jwtSecret } = require('../config/env')

function getCookieToken(req) {
  const cookies = req.headers.cookie?.split(';') || []
  const authCookie = cookies.find((cookie) => cookie.trim().startsWith('expense_tracker_token='))
  if (!authCookie) return null

  try {
    return decodeURIComponent(authCookie.trim().slice('expense_tracker_token='.length))
  } catch (_error) {
    return null
  }
}

async function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || ''
  const [scheme, bearerToken] = authorization.split(' ')
  const token = scheme === 'Bearer' && bearerToken ? bearerToken : getCookieToken(req)

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' })
  }

  if (!jwtSecret) {
    return res.status(500).json({ message: 'Authentication is not configured' })
  }

  try {
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] })

    if (typeof payload.sub !== 'string' || !mongoose.Types.ObjectId.isValid(payload.sub) || !Number.isInteger(payload.tokenVersion)) {
      return res.status(401).json({ message: 'Invalid token' })
    }

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ message: 'Database unavailable' })
    }

    const user = await User.findById(payload.sub)

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return res.status(401).json({ message: 'Token is no longer valid' })
    }

    req.user = user
    return next()
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token has expired' })
    }

    return res.status(401).json({ message: 'Invalid token' })
  }
}

module.exports = requireAuth