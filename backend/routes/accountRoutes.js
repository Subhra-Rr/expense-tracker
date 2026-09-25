const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { archiveAccount, createAccount, getAccounts, updateAccount } = require('../controllers/accountController')

const router = express.Router()
router.use(requireAuth)
router.route('/').get(getAccounts).post(createAccount)
router.put('/:id', updateAccount)
router.patch('/:id/archive', archiveAccount)

module.exports = router
