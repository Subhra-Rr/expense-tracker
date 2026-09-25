const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const { categories, paymentMethods } = require('../models/Expense')
const { incomeCategories } = require('../models/Income')
const RecurringOccurrence = require('../models/RecurringOccurrence')
const { RecurringRule, frequencies, statuses, transactionTypes } = require('../models/RecurringRule')
const { isCategoryAllowed } = require('../utils/categoryService')

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) { res.status(503).json({ message: 'Database unavailable' }); return false }
  return true
}

function validId(id) { return mongoose.Types.ObjectId.isValid(id) }
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day ? null : date
}
function validTimezone(value) { try { new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(); return true } catch { return false } }

function validateRuleInput(body) {
  const { transactionType, title, amount, category, account, frequency, startDate, endDate, timezone = 'Asia/Kolkata', paymentMethod = 'Other' } = body || {}
  const numericAmount = typeof amount === 'number' ? amount : Number(amount)
  if (!transactionTypes.includes(transactionType)) return 'Choose a valid transaction type'
  if (typeof title !== 'string' || title.trim().length < 1 || title.trim().length > 160) return 'Title must be between 1 and 160 characters'
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > 1000000000000) return 'Amount must be greater than zero and no more than INR 1,000,000,000,000'
  if (typeof category !== 'string' || category.trim().length < 1 || category.trim().length > 80) return 'Choose a valid category'
  if (!validId(account)) return 'Choose a valid account'
  if (!frequencies.includes(frequency)) return 'Choose a valid frequency'
  const start = parseDate(startDate)
  const end = endDate ? parseDate(endDate) : null
  if (!start) return 'Choose a valid start date'
  if (endDate && !end) return 'Choose a valid end date'
  if (end && end < start) return 'End date must be on or after the start date'
  if (!validTimezone(timezone)) return 'Choose a valid timezone'
  if (transactionType === 'Expense' && !paymentMethods.includes(paymentMethod)) return 'Choose a valid payment method'
  return null
}

function ruleData(body, userId) {
  const startDate = parseDate(body.startDate)
  return { transactionType: body.transactionType, title: body.title.trim(), amount: Number(body.amount), category: body.category, account: body.account, frequency: body.frequency, startDate, endDate: body.endDate ? parseDate(body.endDate) : undefined, nextDueDate: startDate, timezone: body.timezone || 'Asia/Kolkata', paymentMethod: body.paymentMethod || 'Other', user: userId }
}

async function getRules(req, res) {
  if (!databaseReady(res)) return undefined
  try {
    const rules = await RecurringRule.find({ user: req.user._id }).populate('account', 'name type archived').sort({ status: 1, nextDueDate: 1, createdAt: -1 })
    return res.status(200).json({ rules })
  } catch (_error) { return res.status(500).json({ message: 'Unable to load recurring rules' }) }
}

async function createRule(req, res) {
  const validationError = validateRuleInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!(await isCategoryAllowed(req.user._id, req.body.transactionType === 'Expense' ? 'expense' : 'income', req.body.category))) return res.status(400).json({ message: 'Choose an active category' })
  if (!databaseReady(res)) return undefined
  try {
    const account = await Account.findOne({ _id: req.body.account, user: req.user._id, archived: false })
    if (!account) return res.status(404).json({ message: 'Account not found or archived' })
    const rule = await RecurringRule.create(ruleData(req.body, req.user._id))
    await rule.populate('account', 'name type archived')
    return res.status(201).json({ rule })
  } catch (_error) { return res.status(500).json({ message: 'Unable to create recurring rule' }) }
}

async function updateRule(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid recurring rule id' })
  const validationError = validateRuleInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!(await isCategoryAllowed(req.user._id, req.body.transactionType === 'Expense' ? 'expense' : 'income', req.body.category))) return res.status(400).json({ message: 'Choose an active category' })
  if (!databaseReady(res)) return undefined
  try {
    const account = await Account.findOne({ _id: req.body.account, user: req.user._id, archived: false })
    if (!account) return res.status(404).json({ message: 'Account not found or archived' })
    const existing = await RecurringRule.findOne({ _id: req.params.id, user: req.user._id })
    if (!existing) return res.status(404).json({ message: 'Recurring rule not found' })
    const data = ruleData(req.body, req.user._id)
    if (existing.startDate.toISOString().slice(0, 10) === data.startDate.toISOString().slice(0, 10)) data.nextDueDate = existing.nextDueDate
    const rule = await RecurringRule.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true, runValidators: true }).populate('account', 'name type archived')
    return res.status(200).json({ rule })
  } catch (_error) { return res.status(500).json({ message: 'Unable to update recurring rule' }) }
}

async function updateRuleStatus(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid recurring rule id' })
  if (!statuses.includes(req.body?.status) || req.body.status === 'cancelled') return res.status(400).json({ message: 'Status must be active or paused' })
  if (!databaseReady(res)) return undefined
  try {
    const rule = await RecurringRule.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { status: req.body.status, lastError: null }, { new: true }).populate('account', 'name type archived')
    if (!rule) return res.status(404).json({ message: 'Recurring rule not found' })
    return res.status(200).json({ rule })
  } catch (_error) { return res.status(500).json({ message: 'Unable to update recurring rule status' }) }
}

async function deleteRule(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid recurring rule id' })
  if (!databaseReady(res)) return undefined
  try {
    const rule = await RecurringRule.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    if (!rule) return res.status(404).json({ message: 'Recurring rule not found' })
    return res.status(200).json({ message: 'Recurring rule deleted successfully' })
  } catch (_error) { return res.status(500).json({ message: 'Unable to delete recurring rule' }) }
}

async function getRuleHistory(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid recurring rule id' })
  if (!databaseReady(res)) return undefined
  try {
    const history = await RecurringOccurrence.find({ rule: req.params.id, user: req.user._id }).sort({ scheduledDate: -1 })
    return res.status(200).json({ history })
  } catch (_error) { return res.status(500).json({ message: 'Unable to load recurring history' }) }
}

module.exports = { createRule, deleteRule, getRuleHistory, getRules, updateRule, updateRuleStatus, validateRuleInput }
