const CustomCategory = require('../models/CustomCategory')
const { categories: expenseCategories } = require('../models/Expense')
const { incomeCategories } = require('../models/Income')

async function isCategoryAllowed(userId, type, name) {
  if (typeof name !== 'string' || name.trim().length < 1 || name.trim().length > 80) return false
  const builtIns = type === 'expense' ? expenseCategories : incomeCategories
  if (builtIns.includes(name.trim())) return true
  return Boolean(await CustomCategory.exists({ user: userId, type, nameNormalized: name.trim().toLowerCase(), archived: false }))
}

module.exports = { isCategoryAllowed }
