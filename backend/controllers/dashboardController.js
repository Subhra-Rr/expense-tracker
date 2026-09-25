const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const { Expense, categories } = require('../models/Expense')
const { Income } = require('../models/Income')

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database unavailable' })
    return false
  }

  return true
}

function monthStart(date, offset = 0) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function monthLabel(date) {
  return new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(date)
}

async function getDashboardStats(req, res) {
  if (!databaseReady(res)) return undefined

  const now = new Date()
  const currentMonthStart = monthStart(now)
  const nextMonthStart = monthStart(now, 1)
  const sixMonthStart = monthStart(now, -5)
  const userMatch = { user: req.user._id }

  try {
    const [summaryRows, categoryRows, monthlyRows, recentExpenses, incomeSummaryRows, incomeMonthlyRows, accountBalances] = await Promise.all([
      Expense.aggregate([
        { $match: { ...userMatch, date: { $gte: currentMonthStart, $lt: nextMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, average: { $avg: '$amount' }, highest: { $max: '$amount' } } },
      ]),
      Expense.aggregate([
        { $match: { ...userMatch, date: { $gte: currentMonthStart, $lt: nextMonthStart } } },
        { $group: { _id: '$category', amount: { $sum: '$amount' } } },
        { $sort: { amount: -1 } },
      ]),
      Expense.aggregate([
        { $match: { ...userMatch, date: { $gte: sixMonthStart, $lt: nextMonthStart } } },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Expense.find(userMatch).sort({ date: -1, createdAt: -1 }).limit(8),
      Income.aggregate([
        { $match: { ...userMatch, date: { $gte: currentMonthStart, $lt: nextMonthStart } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 }, average: { $avg: '$amount' }, highest: { $max: '$amount' } } },
      ]),
      Income.aggregate([
        { $match: { ...userMatch, date: { $gte: sixMonthStart, $lt: nextMonthStart } } },
        { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
      Account.find({ user: req.user._id, archived: false }).select('name type currentBalance openingBalance archived').sort({ createdAt: 1 }),
    ])

    const summary = summaryRows[0] || { total: 0, count: 0, average: 0, highest: 0 }
    const categorySpending = categories.map((category) => ({
      category,
      amount: categoryRows.find((row) => row._id === category)?.amount || 0,
    })).filter((row) => row.amount > 0)
    const monthlyLookup = new Map(monthlyRows.map((row) => [monthKey(row._id.year, row._id.month), row.amount]))
    const monthlySpending = Array.from({ length: 6 }, (_, index) => {
      const date = monthStart(now, index - 5)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return { month: key, label: monthLabel(date), amount: monthlyLookup.get(key) || 0 }
    })
    const incomeSummary = incomeSummaryRows[0] || { total: 0, count: 0, average: 0, highest: 0 }
    const incomeLookup = new Map(incomeMonthlyRows.map((row) => [monthKey(row._id.year, row._id.month), row.amount]))
    const incomeVsExpense = Array.from({ length: 6 }, (_, index) => {
      const date = monthStart(now, index - 5)
      const key = monthKey(date.getFullYear(), date.getMonth() + 1)
      return { month: key, label: monthLabel(date), income: incomeLookup.get(key) || 0, expenses: monthlyLookup.get(key) || 0 }
    })

    return res.status(200).json({
      summary: {
        total: summary.total || 0,
        count: summary.count || 0,
        average: summary.average || 0,
        highest: summary.highest || 0,
      },
      incomeSummary: {
        total: incomeSummary.total || 0,
        count: incomeSummary.count || 0,
        average: incomeSummary.average || 0,
        highest: incomeSummary.highest || 0,
      },
      cashFlow: (incomeSummary.total || 0) - (summary.total || 0),
      accountBalances,
      incomeVsExpense,
      categorySpending,
      monthlySpending,
      recentExpenses,
    })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to load dashboard statistics' })
  }
}

module.exports = { getDashboardStats }
