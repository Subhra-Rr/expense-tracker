const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { exportBackup, exportCsv, getReport } = require('../controllers/reportController')

const router = express.Router()
router.use(requireAuth)
router.get('/', getReport)
router.get('/export.csv', exportCsv)
router.get('/backup.json', exportBackup)

module.exports = router
