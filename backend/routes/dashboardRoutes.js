const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { getDashboardStats } = require('../controllers/dashboardController')

const router = express.Router()

router.get('/stats', requireAuth, getDashboardStats)

module.exports = router