const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { dismiss, getPreferences, listNotifications, markAllRead, markRead, updatePreferences } = require('../controllers/notificationController')

const router = express.Router()
router.use(requireAuth)
router.get('/', listNotifications)
router.patch('/read-all', markAllRead)
router.get('/preferences', getPreferences)
router.put('/preferences', updatePreferences)
router.patch('/:id/read', markRead)
router.patch('/:id/dismiss', dismiss)

module.exports = router
