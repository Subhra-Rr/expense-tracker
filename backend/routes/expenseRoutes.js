const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const uploadReceipt = require('../middleware/receiptUpload')
const { createExpense, deleteExpense, deleteExpenseReceipt, getExpense, getExpenses, updateExpense, uploadExpenseReceipt, viewExpenseReceipt } = require('../controllers/expenseController')

const router = express.Router()

router.use(requireAuth)
router.route('/').post(createExpense).get(getExpenses)
router.route('/:id').get(getExpense).put(updateExpense).delete(deleteExpense)
router.route('/:id/receipt').post(uploadReceipt.single('receipt'), uploadExpenseReceipt).get(viewExpenseReceipt).delete(deleteExpenseReceipt)

module.exports = router
