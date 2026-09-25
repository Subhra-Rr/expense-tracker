const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { createTransfer, listTransfers } = require('../controllers/transferController')
const router = express.Router()
router.use(requireAuth)
router.route('/').get(listTransfers).post(createTransfer)
module.exports = router
