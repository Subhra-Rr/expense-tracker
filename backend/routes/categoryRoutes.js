const express = require('express')
const requireAuth = require('../middleware/authMiddleware')
const { archiveCategory, createCategory, listCategories, updateCategory } = require('../controllers/categoryController')

const router = express.Router()
router.use(requireAuth)
router.route('/').get(listCategories).post(createCategory)
router.put('/:id', updateCategory)
router.patch('/:id/archive', archiveCategory)

module.exports = router
