const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { createRule, deleteRule, getRuleHistory, getRules, updateRule, updateRuleStatus } = require('../controllers/recurringController')

const router = express.Router()
router.use(requireAuth)
router.get('/', getRules)
router.post('/', createRule)
router.get('/:id/history', getRuleHistory)
router.put('/:id', updateRule)
router.patch('/:id/status', updateRuleStatus)
router.delete('/:id', deleteRule)

module.exports = router
