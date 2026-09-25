const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { getCurrentBudget, upsertCurrentBudget } = require('../controllers/budgetController')

const router = express.Router()

router.use(requireAuth)
router.get('/current', getCurrentBudget)
router.put('/current', upsertCurrentBudget)

module.exports = router