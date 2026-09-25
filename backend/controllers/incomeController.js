const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const { Income, incomeCategories } = require('../models/Income')
const withTransaction = require('../utils/transaction')
const { isCategoryAllowed } = require('../utils/categoryService')

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database unavailable' })
    return false
  }
  return true
}

function validId(id) { return mongoose.Types.ObjectId.isValid(id) }

function parseDate(value, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function validateIncomeInput(body) {
  const { amount, source, category, date, account, notes = '' } = body || {}
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000000000) return 'Amount must be greater than zero and no more than INR 1,000,000,000,000'
  if (typeof source !== 'string' || source.trim().length < 1 || source.trim().length > 160) return 'Source must be between 1 and 160 characters'
  if (typeof category !== 'string' || category.trim().length < 1 || category.trim().length > 80) return 'Choose a valid income category'
  if (!parseDate(date)) return 'Choose a valid date'
  if (!validId(account)) return 'Choose a valid destination account'
  if (typeof notes !== 'string' || notes.length > 500) return 'Notes cannot exceed 500 characters'
  return null
}

function listOptions(query) {
  const keys = ['page', 'limit', 'search', 'category', 'account', 'startDate', 'endDate', 'sort']
  if (keys.some((key) => query[key] !== undefined && typeof query[key] !== 'string')) return { error: 'Query parameters must have one value each' }
  const page = query.page === undefined ? 1 : Number(query.page)
  const limit = query.limit === undefined ? 10 : Number(query.limit)
  const sorts = { newest: { date: -1, createdAt: -1 }, oldest: { date: 1, createdAt: 1 }, highest: { amount: -1, date: -1 }, lowest: { amount: 1, date: 1 } }
  if (!Number.isInteger(page) || page < 1) return { error: 'Page must be a positive integer' }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: 'Limit must be between 1 and 100' }
  if (query.sort && !sorts[query.sort]) return { error: 'Choose a valid sort order' }
  const filters = {}
  if (query.search?.trim()) filters.source = { $regex: query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' }
  if (query.search?.trim().length > 100) return { error: 'Search must be 100 characters or fewer' }
  if (query.category) {
    if (query.category.trim().length > 80) return { error: 'Choose a valid income category' }
    filters.category = query.category
  }
  if (query.account) {
    if (!validId(query.account)) return { error: 'Invalid account id' }
    filters.account = query.account
  }
  if (query.startDate || query.endDate) {
    const date = {}
    if (query.startDate) { const parsed = parseDate(query.startDate); if (!parsed) return { error: 'Start date must use YYYY-MM-DD format' }; date.$gte = parsed }
    if (query.endDate) { const parsed = parseDate(query.endDate, true); if (!parsed) return { error: 'End date must use YYYY-MM-DD format' }; date.$lt = parsed }
    if (date.$gte && date.$lt && date.$gte >= date.$lt) return { error: 'Start date must be before end date' }
    filters.date = date
  }
  return { page, limit, filters, sort: sorts[query.sort || 'newest'] }
}

function incomeData(body, userId, idempotencyKey) {
  return { amount: Number(body.amount), source: body.source.trim(), category: body.category, date: new Date(body.date), account: body.account, notes: typeof body.notes === 'string' ? body.notes.trim() : '', user: userId, ...(idempotencyKey ? { idempotencyKey } : {}) }
}

async function getIncomes(req, res) {
  const options = listOptions(req.query)
  if (options.error) return res.status(400).json({ message: options.error })
  if (!databaseReady(res)) return undefined
  try {
    const query = { user: req.user._id, ...options.filters }
    const [incomes, total] = await Promise.all([
      Income.find(query).populate('account', 'name type archived').sort(options.sort).skip((options.page - 1) * options.limit).limit(options.limit),
      Income.countDocuments(query),
    ])
    return res.status(200).json({ incomes, pagination: { currentPage: options.page, totalPages: Math.ceil(total / options.limit), totalIncomes: total, limit: options.limit } })
  } catch (_error) { return res.status(500).json({ message: 'Unable to load income records' }) }
}

async function createIncome(req, res) {
  const validationError = validateIncomeInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!(await isCategoryAllowed(req.user._id, 'income', req.body.category))) return res.status(400).json({ message: 'Choose an active income category' })
  if (!databaseReady(res)) return undefined
  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].slice(0, 120) : undefined
  try {
    const result = await withTransaction(async (session) => {
      if (idempotencyKey) {
        const existing = await Income.findOne({ user: req.user._id, idempotencyKey }).populate('account', 'name type archived').session(session)
        if (existing) return { income: existing, duplicate: true }
      }
      const account = await Account.findOne({ _id: req.body.account, user: req.user._id, archived: false }).session(session)
      if (!account) throw Object.assign(new Error('Destination account not found or archived'), { status: 404 })
      const [income] = await Income.create([incomeData(req.body, req.user._id, idempotencyKey)], { session })
      await Account.updateOne({ _id: account._id, user: req.user._id }, { $inc: { currentBalance: income.amount } }, { session })
      await income.populate('account', 'name type archived')
      return { income, duplicate: false }
    })
    return res.status(result.duplicate ? 200 : 201).json({ income: result.income })
  } catch (error) { return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'This income was already processed' : 'Unable to create income' }) }
}

async function updateIncome(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid income id' })
  const validationError = validateIncomeInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!(await isCategoryAllowed(req.user._id, 'income', req.body.category))) return res.status(400).json({ message: 'Choose an active income category' })
  if (!databaseReady(res)) return undefined
  try {
    const income = await withTransaction(async (session) => {
      const oldIncome = await Income.findOne({ _id: req.params.id, user: req.user._id }).session(session)
      if (!oldIncome) throw Object.assign(new Error('Income record not found'), { status: 404 })
      const newAccount = await Account.findOne({ _id: req.body.account, user: req.user._id, archived: false }).session(session)
      if (!newAccount) throw Object.assign(new Error('Destination account not found or archived'), { status: 404 })
      if (oldIncome.account.toString() === newAccount._id.toString()) {
        await Account.updateOne({ _id: newAccount._id }, { $inc: { currentBalance: Number(req.body.amount) - oldIncome.amount } }, { session })
      } else {
        await Account.updateOne({ _id: oldIncome.account, user: req.user._id }, { $inc: { currentBalance: -oldIncome.amount } }, { session })
        await Account.updateOne({ _id: newAccount._id, user: req.user._id }, { $inc: { currentBalance: Number(req.body.amount) } }, { session })
      }
      return Income.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, incomeData(req.body, req.user._id), { new: true, runValidators: true, session }).populate('account', 'name type archived')
    })
    return res.status(200).json({ income })
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to update income' }) }
}

async function deleteIncome(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid income id' })
  if (!databaseReady(res)) return undefined
  try {
    await withTransaction(async (session) => {
      const income = await Income.findOneAndDelete({ _id: req.params.id, user: req.user._id }, { session })
      if (!income) throw Object.assign(new Error('Income record not found'), { status: 404 })
      await Account.updateOne({ _id: income.account, user: req.user._id }, { $inc: { currentBalance: -income.amount } }, { session })
    })
    return res.status(200).json({ message: 'Income deleted successfully' })
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to delete income' }) }
}

module.exports = { createIncome, deleteIncome, getIncomes, listOptions, updateIncome, validateIncomeInput }
