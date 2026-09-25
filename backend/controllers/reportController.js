const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const Budget = require('../models/Budget')
const { Expense, categories } = require('../models/Expense')
const { Income, incomeCategories } = require('../models/Income')
const { RecurringRule } = require('../models/RecurringRule')
const { SavingsGoal } = require('../models/SavingsGoal')
const SavingsGoalEntry = require('../models/SavingsGoalEntry')
const Transfer = require('../models/Transfer')
const Reconciliation = require('../models/Reconciliation')

const maxExportRows = 100000

function ready(res) { if (mongoose.connection.readyState !== 1) { res.status(503).json({ message: 'Database unavailable' }); return false } return true }
function parseDate(value, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  const [year, month, day] = value.split('-').map(Number)
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1)
  return date
}
function dateRange(query) {
  if (query.all === 'true') return { start: null, end: null, startDate: null, endDate: null }
  const now = new Date()
  const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const start = query.startDate ? parseDate(query.startDate) : defaultStart
  const end = query.endDate ? parseDate(query.endDate, true) : defaultEnd
  if (!start || !end || start >= end) return { error: 'Choose a valid date range' }
  return { start, end, startDate: start.toISOString().slice(0, 10), endDate: new Date(end.getTime() - 1).toISOString().slice(0, 10) }
}
async function filtersFor(req, res) {
  const range = dateRange(req.query)
  if (range.error) return { error: range.error }
  const filters = { user: req.user._id }
  if (range.start && range.end) filters.date = { $gte: range.start, $lt: range.end }
  if (req.query.account) {
    if (!mongoose.Types.ObjectId.isValid(req.query.account)) return { error: 'Choose a valid account' }
    const account = await Account.findOne({ _id: req.query.account, user: req.user._id }).select('_id')
    if (!account) return { error: 'Account not found' }
    filters.account = account._id
  }
  if (req.query.category) {
    if (![...categories, ...incomeCategories].includes(req.query.category)) return { error: 'Choose a valid category' }
    filters.category = req.query.category
  }
  return { filters, range }
}

async function getReport(req, res) {
  if (!ready(res)) return undefined
  try {
    const options = await filtersFor(req, res)
    if (options.error) return res.status(400).json({ message: options.error })
    const { filters, range } = options
    const [expenseSummary, incomeSummary, categoriesRows, monthlyExpenses, monthlyIncome, largestExpenses] = await Promise.all([
      Expense.aggregate([{ $match: filters }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Income.aggregate([{ $match: filters }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: filters }, { $group: { _id: '$category', amount: { $sum: '$amount' }, count: { $sum: 1 } } }, { $sort: { amount: -1 } }]),
      Expense.aggregate([{ $match: filters }, { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } }, { $sort: { '_id.year': 1, '_id.month': 1 } }]),
      Income.aggregate([{ $match: filters }, { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, amount: { $sum: '$amount' } } }, { $sort: { '_id.year': 1, '_id.month': 1 } }]),
      Expense.find(filters).select('amount category description merchant date paymentMethod notes account').populate('account', 'name').sort({ amount: -1, date: -1 }).limit(10).lean(),
    ])
    const expenses = expenseSummary[0]?.total || 0
    const income = incomeSummary[0]?.total || 0
    return res.status(200).json({ range: { startDate: range.startDate, endDate: range.endDate }, summary: { totalIncome: income, totalExpenses: expenses, netCashFlow: income - expenses, transactionCount: (expenseSummary[0]?.count || 0) + (incomeSummary[0]?.count || 0) }, categorySpending: categoriesRows.map((row) => ({ category: row._id, amount: row.amount, count: row.count })), monthlySpending: monthlyExpenses.map((row) => ({ month: `${row._id.year}-${String(row._id.month).padStart(2, '0')}`, amount: row.amount })), monthlyIncome: monthlyIncome.map((row) => ({ month: `${row._id.year}-${String(row._id.month).padStart(2, '0')}`, amount: row.amount })), largestExpenses: largestExpenses.map((expense) => ({ date: expense.date, description: expense.merchant || expense.description, category: expense.category, amount: expense.amount, account: expense.account?.name || '' })) })
  } catch (_error) { return res.status(500).json({ message: 'Unable to generate report' }) }
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value)
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}
function writeRow(res, values) { return new Promise((resolve) => { if (res.write(`${values.map(csvCell).join(',')}\r\n`)) resolve(); else res.once('drain', resolve) }) }
function csvPipeline(userId, filters, model, type, res) {
  const pipeline = [{ $match: filters }, { $lookup: { from: 'accounts', localField: 'account', foreignField: '_id', as: 'accountData' } }, { $project: { date: 1, category: 1, description: 1, source: 1, paymentMethod: 1, notes: 1, amount: 1, account: { $ifNull: [{ $arrayElemAt: ['$accountData.name', 0] }, ''] } } }, { $sort: { date: -1, _id: -1 } }]
  return { cursor: model.aggregate(pipeline).cursor({ batchSize: 500 }), type }
}
async function exportCsv(req, res) {
  if (!ready(res)) return undefined
  try {
    const options = await filtersFor(req, res)
    if (options.error) return res.status(400).json({ message: options.error })
    const expenseFilters = { ...options.filters }
    const incomeFilters = { ...options.filters }
    delete expenseFilters.user
    delete incomeFilters.user
    const userFilter = { user: req.user._id, date: options.filters.date }
    if (options.filters.account) { expenseFilters.account = options.filters.account; incomeFilters.account = options.filters.account }
    if (options.filters.category) { expenseFilters.category = options.filters.category; incomeFilters.category = options.filters.category }
    const streams = [csvPipeline(req.user._id, { ...expenseFilters, user: req.user._id }, Expense, 'Expense', res), csvPipeline(req.user._id, { ...incomeFilters, user: req.user._id }, Income, 'Income', res)]
    res.status(200).set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="personal-expense-tracker.csv"', 'Cache-Control': 'no-store' })
    res.write('\ufeff')
    await writeRow(res, ['Date', 'Transaction type', 'Description', 'Category', 'Account', 'Amount', 'Payment method', 'Notes'])
    let rows = 0
    for (const stream of streams) {
      for await (const row of stream.cursor) {
        if (rows >= maxExportRows) break
        await writeRow(res, [new Date(row.date).toISOString().slice(0, 10), stream.type, row.description || row.source, row.category, row.account, row.amount, row.paymentMethod || '', row.notes || ''])
        rows += 1
      }
    }
    return res.end()
  } catch (_error) { if (!res.headersSent) return res.status(500).json({ message: 'Unable to export transactions' }); return res.end() }
}

async function exportBackup(req, res) {
  if (!ready(res)) return undefined
  try {
    const user = req.user._id
    const [rawAccounts, rawExpenses, rawIncomes, rawBudgets, rawRecurringRules, rawGoals, rawGoalEntries, rawTransfers, rawReconciliations] = await Promise.all([
      Account.find({ user }).select('-user -__v').lean(),
      Expense.find({ user }).select('-user -idempotencyKey -receipt -__v').lean(),
      Income.find({ user }).select('-user -idempotencyKey -__v').lean(),
      Budget.find({ user }).select('-user -__v').lean(),
      RecurringRule.find({ user }).select('-user -processingAt -lastError -__v').lean(),
      SavingsGoal.find({ user }).select('-user -__v').lean(),
      SavingsGoalEntry.find({ user }).select('-user -__v').lean(),
      Transfer.find({ user }).select('-user -idempotencyKey -__v').lean(),
      Reconciliation.find({ user }).select('-user -__v').lean(),
    ])
    const accountNames = new Map(rawAccounts.map((account) => [String(account._id), account.name]))
    const ruleTitles = new Map(rawRecurringRules.map((rule) => [String(rule._id), rule.title]))
    const goalNames = new Map(rawGoals.map((goal) => [String(goal._id), goal.name]))
    const clean = (record, extra = {}) => { const { _id, user, __v, idempotencyKey, receipt, processingAt, lastError, account, recurringRule, ...data } = record; return { ...data, ...(account ? { accountName: accountNames.get(String(account)) || '' } : {}), ...(recurringRule ? { recurringRuleTitle: ruleTitles.get(String(recurringRule)) || '' } : {}), ...extra } }
    const accounts = rawAccounts.map(({ _id, user, __v, ...account }) => account)
    const expenses = rawExpenses.map((record) => clean(record))
    const incomes = rawIncomes.map((record) => clean(record))
    const budgets = rawBudgets.map(({ _id, user, __v, ...budget }) => budget)
    const recurringRules = rawRecurringRules.map(({ _id, user, __v, account, ...rule }) => ({ ...rule, accountName: accountNames.get(String(account)) || '' }))
    const savingsGoals = rawGoals.map(({ _id, user, __v, ...goal }) => goal)
    const savingsGoalEntries = rawGoalEntries.map(({ _id, user, __v, goal, ...entry }) => ({ ...entry, goalName: goalNames.get(String(goal)) || '' }))
    const transfers = rawTransfers.map(({ _id, user, __v, sourceAccount, destinationAccount, ...transfer }) => ({ ...transfer, sourceAccountName: accountNames.get(String(sourceAccount)) || '', destinationAccountName: accountNames.get(String(destinationAccount)) || '' }))
    const reconciliations = rawReconciliations.map(({ _id, user, __v, account, ...record }) => ({ ...record, accountName: accountNames.get(String(account)) || '' }))
    res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="personal-expense-tracker-data-export.json"', 'Cache-Control': 'no-store' })
    return res.status(200).json({ format: 'personal-expense-tracker-data-export', version: 3, generatedAt: new Date().toISOString(), restorable: false, note: 'This export documents personal records for portability. It is not a restorable backup and cannot be imported by this application.', data: { accounts, expenses, incomes, budgets, recurringRules, savingsGoals, savingsGoalEntries, transfers, reconciliations } })
  } catch (_error) { return res.status(500).json({ message: 'Unable to export personal data' }) }
}

module.exports = { exportBackup, exportCsv, getReport }
