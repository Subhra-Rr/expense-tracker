const mongoose = require('mongoose')
const { Account, accountTypes } = require('../models/Account')
const { RecurringRule } = require('../models/RecurringRule')

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database unavailable' })
    return false
  }
  return true
}

function validId(id) { return mongoose.Types.ObjectId.isValid(id) }

function validateAccountInput(body) {
  const { name, type, openingBalance } = body || {}
  const amount = typeof openingBalance === 'number' ? openingBalance : Number(openingBalance)
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return 'Account name must be between 2 and 80 characters'
  if (!accountTypes.includes(type)) return 'Choose a valid account type'
  if (!Number.isFinite(amount) || amount < 0 || amount > 1000000000000) return 'Opening balance must be zero or more and no more than INR 1,000,000,000,000'
  return null
}

async function getAccounts(req, res) {
  if (!databaseReady(res)) return undefined
  try {
    const accounts = await Account.find({ user: req.user._id }).sort({ archived: 1, createdAt: 1 })
    return res.status(200).json({ accounts })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to load accounts' })
  }
}

async function createAccount(req, res) {
  const validationError = validateAccountInput(req.body)
  if (validationError) return res.status(400).json({ message: validationError })
  if (!databaseReady(res)) return undefined
  try {
    const openingBalance = Number(req.body.openingBalance)
    const account = await Account.create({
      name: req.body.name.trim(), type: req.body.type, openingBalance, currentBalance: openingBalance, user: req.user._id,
    })
    return res.status(201).json({ account })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to create account' })
  }
}

async function updateAccount(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid account id' })
  const { name, type } = req.body || {}
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ message: 'Account name must be between 2 and 80 characters' })
  if (!accountTypes.includes(type)) return res.status(400).json({ message: 'Choose a valid account type' })
  if (!databaseReady(res)) return undefined
  try {
    const account = await Account.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { name: name.trim(), type }, { new: true, runValidators: true })
    if (!account) return res.status(404).json({ message: 'Account not found' })
    return res.status(200).json({ account })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to update account' })
  }
}

async function archiveAccount(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid account id' })
  if (!databaseReady(res)) return undefined
  try {
    const account = await Account.findOne({ _id: req.params.id, user: req.user._id })
    if (!account) return res.status(404).json({ message: 'Account not found' })
    const activeRecurringRules = await RecurringRule.countDocuments({ account: account._id, user: req.user._id, status: 'active' })
    if (req.body?.confirm !== true && (account.currentBalance !== 0 || activeRecurringRules > 0)) {
      return res.status(409).json({
        message: 'This account has a balance or active recurring rules. Confirm archiving deliberately.',
        requiresConfirmation: true,
        balance: account.currentBalance,
        activeRecurringRules,
      })
    }
    account.archived = true
    await account.save()
    return res.status(200).json({ account })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to archive account' })
  }
}

module.exports = { archiveAccount, createAccount, getAccounts, updateAccount, validateAccountInput }
