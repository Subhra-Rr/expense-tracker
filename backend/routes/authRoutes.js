const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { changePassword, currentUser, deleteAccount, login, logout, register, updatePreferences, updateProfile } = require('../controllers/authController')

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.get('/me', requireAuth, currentUser)
router.post('/logout', requireAuth, logout)
router.patch('/profile', requireAuth, updateProfile)
router.patch('/preferences', requireAuth, updatePreferences)
router.post('/password', requireAuth, changePassword)
router.delete('/account', requireAuth, deleteAccount)

module.exports = router
