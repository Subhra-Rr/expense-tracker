const jwt = require('jsonwebtoken')
const { jwtExpiresIn, jwtSecret, nodeEnv } = require('../config/env')

const cookieName = 'expense_tracker_token'
const cookieOptions = {
  httpOnly: true,
  sameSite: nodeEnv === 'production' ? 'none' : 'lax',
  secure: nodeEnv === 'production',
  path: '/',
}

function createToken(user) {
  if (!jwtSecret) {
    throw new Error('JWT_SECRET is not configured')
  }

  return jwt.sign(
    { sub: user._id.toString(), tokenVersion: user.tokenVersion },
    jwtSecret,
    { algorithm: 'HS256', expiresIn: jwtExpiresIn },
  )
}

function publicUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    notificationPreferences: user.notificationPreferences,
    preferences: user.preferences,
  }
}

function setAuthCookie(res, token) {
  res.cookie(cookieName, token, cookieOptions)
}

function clearAuthCookie(res) {
  res.clearCookie(cookieName, cookieOptions)
}

module.exports = { clearAuthCookie, createToken, publicUser, setAuthCookie }
