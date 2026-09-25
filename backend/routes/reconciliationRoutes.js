const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { adjustReconciliation, createReconciliation, listReconciliations } = require('../controllers/reconciliationController')
const router = express.Router()
router.use(requireAuth)
router.route('/').get(listReconciliations).post(createReconciliation)
router.patch('/:id/adjust', adjustReconciliation)
module.exports = router
