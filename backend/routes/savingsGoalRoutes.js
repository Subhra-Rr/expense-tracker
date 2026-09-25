const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { addEntry, archiveGoal, createGoal, getGoals, getHistory, updateGoal } = require('../controllers/savingsGoalController')

const router = express.Router()
router.use(requireAuth)
router.route('/').get(getGoals).post(createGoal)
router.route('/:id').put(updateGoal)
router.patch('/:id/archive', archiveGoal)
router.post('/:id/entries', addEntry)
router.get('/:id/history', getHistory)
module.exports = router
