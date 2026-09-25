const mongoose = require('mongoose')
const CustomCategory = require('../models/CustomCategory')

function validId(id) { return mongoose.Types.ObjectId.isValid(id) }

async function listCategories(req, res) {
  try {
    const categories = await CustomCategory.find({ user: req.user._id }).sort({ type: 1, archived: 1, name: 1 })
    return res.json({ categories })
  } catch (_error) { return res.status(500).json({ message: 'Unable to load categories' }) }
}

async function createCategory(req, res) {
  const { name, type } = req.body || {}
  if (!['expense', 'income'].includes(type) || typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80) return res.status(400).json({ message: 'Enter a valid category name and type' })
  try {
    const category = await CustomCategory.create({ name: name.trim(), nameNormalized: name.trim().toLowerCase(), type, user: req.user._id })
    return res.status(201).json({ category })
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'That category already exists' : 'Unable to create category' })
  }
}

async function updateCategory(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid category id' })
  const { name } = req.body || {}
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80) return res.status(400).json({ message: 'Category name must be between 1 and 80 characters' })
  try {
    const category = await CustomCategory.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { name: name.trim(), nameNormalized: name.trim().toLowerCase() }, { new: true, runValidators: true })
    if (!category) return res.status(404).json({ message: 'Category not found' })
    return res.json({ category })
  } catch (error) { return res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'That category already exists' : 'Unable to update category' }) }
}

async function archiveCategory(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid category id' })
  try {
    const category = await CustomCategory.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { archived: true }, { new: true })
    if (!category) return res.status(404).json({ message: 'Category not found' })
    return res.json({ category })
  } catch (_error) { return res.status(500).json({ message: 'Unable to archive category' }) }
}

module.exports = { archiveCategory, createCategory, listCategories, updateCategory }
