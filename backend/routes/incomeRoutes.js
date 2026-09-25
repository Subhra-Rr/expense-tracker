const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { createIncome, deleteIncome, getIncomes, updateIncome } = require('../controllers/incomeController')

const router = express.Router()
router.use(requireAuth)
router.route('/').get(getIncomes).post(createIncome)
router.route('/:id').put(updateIncome).delete(deleteIncome)

module.exports = router
