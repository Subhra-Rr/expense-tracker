const mongoose = require('mongoose')
const Budget = require('../models/Budget')
const { Expense } = require('../models/Expense')
const { createBudgetNotifications } = require('../utils/notificationService')

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database unavailable' })
    return false
  }

  return true
}

function currentPeriod(date = new Date()) {
  return {
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    start: new Date(date.getFullYear(), date.getMonth(), 1),
    end: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  }
}

function calculateBudgetStats(amount, spent) {
  const budgetAmount = Number(amount) || 0
  const spentAmount = Number(spent) || 0
  const percentageUsed = budgetAmount > 0 ? (spentAmount / budgetAmount) * 100 : 0

  return {
    budget: budgetAmount,
    spent: spentAmount,
    remaining: budgetAmount - spentAmount,
    percentageUsed: Math.round(percentageUsed * 100) / 100,
  }
}

function validateAmount(amount) {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000000000) return null
  return numericAmount
}

async function getCurrentBudget(req, res) {
  if (!databaseReady(res)) return undefined
  const period = currentPeriod()

  try {
    const [budget, spentRows] = await Promise.all([
      Budget.findOne({ user: req.user._id, month: period.month, year: period.year }),
      Expense.aggregate([
        { $match: { user: req.user._id, date: { $gte: period.start, $lt: period.end } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])
    const stats = calculateBudgetStats(budget?.amount, spentRows[0]?.total)

    return res.status(200).json({
      budget: budget ? { id: budget._id, amount: budget.amount, month: budget.month, year: budget.year } : null,
      ...stats,
      month: period.month,
      year: period.year,
    })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to load monthly budget' })
  }
}

async function upsertCurrentBudget(req, res) {
  const amount = validateAmount(req.body?.amount)
  if (!amount) return res.status(400).json({ message: 'Budget amount must be greater than zero' })
  if (!databaseReady(res)) return undefined
  const period = currentPeriod()

  try {
    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, month: period.month, year: period.year },
      { user: req.user._id, month: period.month, year: period.year, amount },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
    void createBudgetNotifications(req.user._id).catch(() => {})
    return res.status(200).json({ budget: { id: budget._id, amount: budget.amount, month: budget.month, year: budget.year } })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to save monthly budget' })
  }
}

module.exports = { calculateBudgetStats, getCurrentBudget, upsertCurrentBudget }
