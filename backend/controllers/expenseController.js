const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const { Expense, categories, paymentMethods } = require('../models/Expense')
const Receipt = require('../models/Receipt')
const { detectImage, receiptPath, removeReceipt, saveReceipt } = require('../utils/receiptStorage')
const withTransaction = require('../utils/transaction')
const { createBudgetNotifications } = require('../utils/notificationService')
const { isCategoryAllowed } = require('../utils/categoryService')

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database unavailable' })
    return false
  }

  return true
}

function validId(id) {
  return mongoose.Types.ObjectId.isValid(id)
}

function validateExpenseInput(body) {
  const { amount, category, description, date, paymentMethod, notes = '', account, merchant = '', tags = [] } = body || {}
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)

  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000000000) return 'Amount must be greater than zero and no more than INR 1,000,000,000,000'
  if (typeof category !== 'string' || category.trim().length < 1 || category.trim().length > 80) return 'Choose a valid category'
  if (typeof description !== 'string' || description.trim().length < 1 || description.trim().length > 160) {
    return 'Description must be between 1 and 160 characters'
  }
  if (!parseDate(date)) return 'Choose a valid date'
  if (!paymentMethods.includes(paymentMethod)) return 'Choose a valid payment method'
  if (account !== undefined && !validId(account)) return 'Choose a valid account'
  if (typeof notes !== 'string' || notes.length > 500) return 'Notes cannot exceed 500 characters'
  if (typeof merchant !== 'string' || merchant.length > 160) return 'Merchant cannot exceed 160 characters'
  if (!Array.isArray(tags) || tags.length > 10 || tags.some((tag) => typeof tag !== 'string' || tag.trim().length < 1 || tag.trim().length > 40)) return 'Tags must contain 1 to 10 non-empty values of 40 characters or fewer'

  return null
}

function expenseData(body, userId, idempotencyKey) {
  return {
    amount: Number(body.amount),
    category: body.category,
    description: body.description.trim(),
    date: new Date(body.date),
    paymentMethod: body.paymentMethod,
    ...(body.account ? { account: body.account } : {}),
    notes: typeof body.notes === 'string' ? body.notes.trim() : '',
    merchant: typeof body.merchant === 'string' ? body.merchant.trim() : '',
    tags: Array.isArray(body.tags) ? [...new Set(body.tags.map((tag) => tag.trim().toLowerCase()))] : [],
    user: userId,
    ...(idempotencyKey ? { idempotencyKey } : {}),
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseDate(value, endOfDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return null
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null
  if (endOfDay) date.setUTCDate(date.getUTCDate() + 1)
  return date
}

function getListOptions(query) {
  if (['page', 'limit', 'search', 'merchant', 'tags', 'category', 'paymentMethod', 'startDate', 'endDate', 'sort'].some((key) => query[key] !== undefined && typeof query[key] !== 'string')) {
    return { error: 'Query parameters must have one value each' }
  }

  const page = query.page === undefined ? 1 : Number(query.page)
  const limit = query.limit === undefined ? 10 : Number(query.limit)
  const sortValues = {
    newest: { date: -1, createdAt: -1 },
    oldest: { date: 1, createdAt: 1 },
    highest: { amount: -1, date: -1 },
    lowest: { amount: 1, date: 1 },
  }

  if (!Number.isInteger(page) || page < 1) return { error: 'Page must be a positive integer' }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: 'Limit must be between 1 and 100' }
  if (query.sort && !sortValues[query.sort]) return { error: 'Choose a valid sort order' }

  const filters = {}
  if (query.search && query.search.trim().length > 100) return { error: 'Search must be 100 characters or fewer' }
  if (query.search?.trim()) filters.description = { $regex: escapeRegex(query.search.trim()), $options: 'i' }
  if (query.merchant?.trim()) filters.merchant = { $regex: escapeRegex(query.merchant.trim()), $options: 'i' }
  if (query.tags?.trim()) {
    const tags = query.tags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean)
    if (!tags.length || tags.length > 10 || tags.some((tag) => tag.length > 40)) return { error: 'Tags filter is invalid' }
    filters.tags = { $all: tags }
  }
  if (query.category) {
    if (query.category.trim().length > 80) return { error: 'Choose a valid category' }
    filters.category = query.category
  }
  if (query.paymentMethod) {
    if (!paymentMethods.includes(query.paymentMethod)) return { error: 'Choose a valid payment method' }
    filters.paymentMethod = query.paymentMethod
  }

  if (query.startDate || query.endDate) {
    const dateFilter = {}
    if (query.startDate) {
      const startDate = parseDate(query.startDate)
      if (!startDate) return { error: 'Start date must use YYYY-MM-DD format' }
      dateFilter.$gte = startDate
    }
    if (query.endDate) {
      const endDate = parseDate(query.endDate, true)
      if (!endDate) return { error: 'End date must use YYYY-MM-DD format' }
      dateFilter.$lt = endDate
    }
    if (dateFilter.$gte && dateFilter.$lt && dateFilter.$gte >= dateFilter.$lt) return { error: 'Start date must be before end date' }
    filters.date = dateFilter
  }

  return { page, limit, filters, sort: sortValues[query.sort || 'newest'] }
}

async function createExpense(req, res) {
  const validationError = validateExpenseInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!(await isCategoryAllowed(req.user._id, 'expense', req.body.category))) return res.status(400).json({ message: 'Choose an active expense category' })
  if (!databaseReady(res)) return undefined

  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].slice(0, 120) : undefined
  try {
    const result = await withTransaction(async (session) => {
      if (idempotencyKey) {
        const existing = await Expense.findOne({ user: req.user._id, idempotencyKey }).populate('account', 'name type archived').session(session)
        if (existing) return { expense: existing, duplicate: true }
      }
      if (req.body.account) {
        const account = await Account.findOne({ _id: req.body.account, user: req.user._id, archived: false }).session(session)
        if (!account) throw Object.assign(new Error('Account not found or archived'), { status: 404 })
      }
      const [expense] = await Expense.create([expenseData(req.body, req.user._id, idempotencyKey)], { session })
      if (expense.account) await Account.updateOne({ _id: expense.account, user: req.user._id }, { $inc: { currentBalance: -expense.amount } }, { session })
      await expense.populate('account', 'name type archived')
      return { expense, duplicate: false }
    })
    void createBudgetNotifications(req.user._id).catch(() => {})
    return res.status(result.duplicate ? 200 : 201).json({ expense: result.expense })
  } catch (error) {
    return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'This expense was already processed' : 'Unable to create expense' })
  }
}

async function getExpenses(req, res) {
  const options = getListOptions(req.query)
  if (options.error) return res.status(400).json({ message: options.error })
  if (!databaseReady(res)) return undefined

  try {
    const query = { user: req.user._id, ...options.filters }
    const [expenses, totalExpenses] = await Promise.all([
      Expense.find(query).populate('account', 'name type archived').populate('receipt', 'contentType size originalName').sort(options.sort).skip((options.page - 1) * options.limit).limit(options.limit),
      Expense.countDocuments(query),
    ])
    return res.status(200).json({
      expenses,
      pagination: {
        currentPage: options.page,
        totalPages: Math.ceil(totalExpenses / options.limit),
        totalExpenses,
        limit: options.limit,
      },
    })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to load expenses' })
  }
}

async function getExpense(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' })
  if (!databaseReady(res)) return undefined

  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id }).populate('account', 'name type archived').populate('receipt', 'contentType size originalName')
    if (!expense) return res.status(404).json({ message: 'Expense not found' })
    return res.status(200).json({ expense })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to load expense' })
  }
}

async function updateExpense(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' })
  const validationError = validateExpenseInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!(await isCategoryAllowed(req.user._id, 'expense', req.body.category))) return res.status(400).json({ message: 'Choose an active expense category' })
  if (!databaseReady(res)) return undefined

  try {
    const expense = await withTransaction(async (session) => {
      const oldExpense = await Expense.findOne({ _id: req.params.id, user: req.user._id }).session(session)
      if (!oldExpense) throw Object.assign(new Error('Expense not found'), { status: 404 })
      if (req.body.account) {
        const newAccount = await Account.findOne({ _id: req.body.account, user: req.user._id, archived: false }).session(session)
        if (!newAccount) throw Object.assign(new Error('Account not found or archived'), { status: 404 })
      }
      if (oldExpense.account?.toString() === req.body.account) {
        await Account.updateOne({ _id: oldExpense.account, user: req.user._id }, { $inc: { currentBalance: oldExpense.amount - Number(req.body.amount) } }, { session })
      } else {
        if (oldExpense.account) await Account.updateOne({ _id: oldExpense.account, user: req.user._id }, { $inc: { currentBalance: oldExpense.amount } }, { session })
        if (req.body.account) await Account.updateOne({ _id: req.body.account, user: req.user._id }, { $inc: { currentBalance: -Number(req.body.amount) } }, { session })
      }
      const data = expenseData({ ...req.body, merchant: req.body.merchant ?? oldExpense.merchant, tags: req.body.tags ?? oldExpense.tags }, req.user._id)
      return Expense.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true, runValidators: true, session }).populate('account', 'name type archived').populate('receipt', 'contentType size originalName')
    })
    void createBudgetNotifications(req.user._id).catch(() => {})
    return res.status(200).json({ expense })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to update expense' })
  }
}

async function deleteExpense(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' })
  if (!databaseReady(res)) return undefined

  try {
    let receiptToRemove
    await withTransaction(async (session) => {
      const expense = await Expense.findOneAndDelete({ _id: req.params.id, user: req.user._id }, { session })
      if (!expense) throw Object.assign(new Error('Expense not found'), { status: 404 })
      if (expense.receipt) {
        receiptToRemove = await Receipt.findOneAndDelete({ _id: expense.receipt, user: req.user._id }, { session })
      }
      if (expense.account) await Account.updateOne({ _id: expense.account, user: req.user._id }, { $inc: { currentBalance: expense.amount } }, { session })
    })
    if (receiptToRemove) await removeReceipt(receiptToRemove.storageName)
    void createBudgetNotifications(req.user._id).catch(() => {})
    return res.status(200).json({ message: 'Expense deleted successfully' })
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to delete expense' })
  }
}

async function uploadExpenseReceipt(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' })
  if (!req.file) return res.status(400).json({ message: 'Choose a receipt image' })
  const image = detectImage(req.file.buffer)
  if (!image) return res.status(400).json({ message: 'Receipt must be a valid JPEG, PNG, or WebP image' })
  if (!databaseReady(res)) return undefined

  let savedReceipt
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id })
    if (!expense) return res.status(404).json({ message: 'Expense not found' })
    const oldReceipt = expense.receipt ? await Receipt.findOne({ _id: expense.receipt, user: req.user._id }).select('+storageName') : null
    savedReceipt = await saveReceipt(req.file.buffer, image)
    const receipt = await Receipt.findOneAndUpdate(
      { expense: expense._id, user: req.user._id },
      { ...savedReceipt, originalName: req.file.originalname.slice(0, 180), user: req.user._id, expense: expense._id },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    )
    await Expense.updateOne({ _id: expense._id, user: req.user._id }, { $set: { receipt: receipt._id } })
    if (oldReceipt && oldReceipt.storageName !== savedReceipt.storageName) await removeReceipt(oldReceipt.storageName)
    return res.status(200).json({ receipt: { _id: receipt._id, contentType: receipt.contentType, size: receipt.size, originalName: receipt.originalName } })
  } catch (error) {
    if (savedReceipt) await removeReceipt(savedReceipt.storageName)
    return res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000 ? 'Unable to replace receipt safely' : 'Unable to save receipt' })
  }
}

async function viewExpenseReceipt(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' })
  if (!databaseReady(res)) return undefined
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id }).select('receipt')
    if (!expense || !expense.receipt) return res.status(404).json({ message: 'Receipt not found' })
    const receipt = await Receipt.findOne({ _id: expense.receipt, expense: expense._id, user: req.user._id }).select('+storageName')
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' })
    res.set('Cache-Control', 'private, no-store')
    res.type(receipt.contentType)
    return res.sendFile(receiptPath(receipt.storageName), { dotfiles: 'deny' })
  } catch (_error) { return res.status(500).json({ message: 'Unable to load receipt' }) }
}

async function deleteExpenseReceipt(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid expense id' })
  if (!databaseReady(res)) return undefined
  try {
    const expense = await Expense.findOne({ _id: req.params.id, user: req.user._id }).select('receipt')
    if (!expense) return res.status(404).json({ message: 'Expense not found' })
    const receipt = await Receipt.findOneAndDelete({ expense: req.params.id, user: req.user._id }).select('+storageName')
    if (!receipt) return res.status(404).json({ message: 'Receipt not found' })
    await Expense.updateOne({ _id: expense._id, user: req.user._id }, { $unset: { receipt: 1 } })
    await removeReceipt(receipt.storageName)
    return res.status(200).json({ message: 'Receipt removed successfully' })
  } catch (_error) { return res.status(500).json({ message: 'Unable to remove receipt' }) }
}

module.exports = { createExpense, deleteExpense, deleteExpenseReceipt, getExpense, getExpenses, getListOptions, updateExpense, uploadExpenseReceipt, validateExpenseInput, viewExpenseReceipt }
