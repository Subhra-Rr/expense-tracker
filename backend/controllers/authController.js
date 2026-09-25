const bcrypt = require('bcrypt')
const mongoose = require('mongoose')
const User = require('../models/User')
const { Account } = require('../models/Account')
const Budget = require('../models/Budget')
const { Expense } = require('../models/Expense')
const { Income } = require('../models/Income')
const { RecurringRule } = require('../models/RecurringRule')
const RecurringOccurrence = require('../models/RecurringOccurrence')
const Notification = require('../models/Notification')
const Receipt = require('../models/Receipt')
const Transfer = require('../models/Transfer')
const Reconciliation = require('../models/Reconciliation')
const { SavingsGoal } = require('../models/SavingsGoal')
const SavingsGoalEntry = require('../models/SavingsGoalEntry')
const CustomCategory = require('../models/CustomCategory')
const withTransaction = require('../utils/transaction')
const { removeReceipt } = require('../utils/receiptStorage')
const { clearAuthCookie, createToken, publicUser, setAuthCookie } = require('../utils/auth')

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function databaseReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ message: 'Database unavailable' })
    return false
  }

  return true
}

function registerValidation({ name, email, password, confirmPassword }) {
  if (![name, email, password, confirmPassword].every((value) => typeof value === 'string')) {
    return 'Name, email, password, and password confirmation are required'
  }

  if (name.trim().length < 2 || name.trim().length > 80) {
    return 'Name must be between 2 and 80 characters'
  }

  if (!emailPattern.test(email.trim())) {
    return 'Enter a valid email address'
  }

  if (password.length < 8 || password.length > 72) {
    return 'Password must be between 8 and 72 characters'
  }

  if (password !== confirmPassword) {
    return 'Passwords do not match'
  }

  return null
}

async function register(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const { name, email, password, confirmPassword } = body
  const validationError = registerValidation({ name, email, password, confirmPassword })

  if (validationError) {
    return res.status(400).json({ message: validationError })
  }

  if (!databaseReady(res)) return undefined

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await User.findOne({ email: normalizedEmail })

    if (existingUser) {
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash })

    setAuthCookie(res, createToken(user))
    return res.status(201).json({ user: publicUser(user) })
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    return res.status(500).json({ message: 'Unable to create account' })
  }
}

async function login(req, res) {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const { email, password } = body

  if (typeof email !== 'string' || typeof password !== 'string' || !emailPattern.test(email.trim())) {
    return res.status(400).json({ message: 'Enter a valid email and password' })
  }

  if (!databaseReady(res)) return undefined

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash')
    const passwordMatches = user && await bcrypt.compare(password, user.passwordHash)

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    setAuthCookie(res, createToken(user))
    return res.status(200).json({ user: publicUser(user) })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to log in' })
  }
}

function currentUser(req, res) {
  return res.status(200).json({ user: publicUser(req.user) })
}

async function logout(req, res) {
  if (!databaseReady(res)) {
    clearAuthCookie(res)
    return undefined
  }

  try {
    await User.findByIdAndUpdate(req.user._id, { $inc: { tokenVersion: 1 } })
    clearAuthCookie(res)
    return res.status(200).json({ message: 'Logged out successfully' })
  } catch (_error) {
    return res.status(500).json({ message: 'Unable to log out' })
  }
}

async function updateProfile(req, res) {
  const name = req.body?.name
  if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 80) return res.status(400).json({ message: 'Name must be between 2 and 80 characters' })
  try {
    const user = await User.findByIdAndUpdate(req.user._id, { name: name.trim() }, { new: true, runValidators: true })
    return res.json({ user: publicUser(user) })
  } catch (_error) { return res.status(500).json({ message: 'Unable to update profile' }) }
}

async function updatePreferences(req, res) {
  const preferences = req.body?.preferences || {}
  const notificationPreferences = req.body?.notificationPreferences || {}
  const allowedDateFormats = ['DD/MM/YYYY', 'YYYY-MM-DD', 'MMM D, YYYY']
  const allowedMonths = ['current', 'previous']
  const allowedThemes = ['light', 'dark', 'system']
  if (preferences.currency !== undefined && preferences.currency !== 'INR') return res.status(400).json({ message: 'Only INR is currently supported' })
  if (preferences.dateFormat !== undefined && !allowedDateFormats.includes(preferences.dateFormat)) return res.status(400).json({ message: 'Choose a valid date format' })
  if (preferences.dashboardMonth !== undefined && !allowedMonths.includes(preferences.dashboardMonth)) return res.status(400).json({ message: 'Choose a valid dashboard month' })
  if (preferences.theme !== undefined && !allowedThemes.includes(preferences.theme)) return res.status(400).json({ message: 'Choose a valid theme' })
  if (Object.keys(notificationPreferences).some((key) => !['budgetAlerts', 'recurringAlerts'].includes(key) || typeof notificationPreferences[key] !== 'boolean')) return res.status(400).json({ message: 'Notification preferences are invalid' })
  try {
    const update = {}
    for (const key of ['currency', 'dateFormat', 'dashboardMonth', 'theme']) if (preferences[key] !== undefined) update[`preferences.${key}`] = preferences[key]
    for (const key of ['budgetAlerts', 'recurringAlerts']) if (notificationPreferences[key] !== undefined) update[`notificationPreferences.${key}`] = notificationPreferences[key]
    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true, runValidators: true })
    return res.json({ user: publicUser(user) })
  } catch (_error) { return res.status(500).json({ message: 'Unable to update preferences' }) }
}

async function changePassword(req, res) {
  const { currentPassword, newPassword, confirmPassword } = req.body || {}
  if (![currentPassword, newPassword, confirmPassword].every((value) => typeof value === 'string')) return res.status(400).json({ message: 'Current and new passwords are required' })
  if (newPassword.length < 8 || newPassword.length > 72) return res.status(400).json({ message: 'New password must be between 8 and 72 characters' })
  if (newPassword !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' })
  try {
    const user = await User.findById(req.user._id).select('+passwordHash')
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) return res.status(401).json({ message: 'Current password is incorrect' })
    user.passwordHash = await bcrypt.hash(newPassword, 12)
    user.tokenVersion += 1
    await user.save()
    setAuthCookie(res, createToken(user))
    return res.json({ user: publicUser(user) })
  } catch (_error) { return res.status(500).json({ message: 'Unable to change password' }) }
}

async function deleteAccount(req, res) {
  const { password, confirmation } = req.body || {}
  if (confirmation !== 'DELETE') return res.status(400).json({ message: 'Type DELETE to confirm permanent account deletion' })
  if (typeof password !== 'string' || password.length === 0) return res.status(400).json({ message: 'Password confirmation is required' })
  let receiptNames = []
  try {
    const user = await User.findById(req.user._id).select('+passwordHash')
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return res.status(401).json({ message: 'Password is incorrect' })
    receiptNames = (await Receipt.find({ user: user._id }).select('+storageName')).map((receipt) => receipt.storageName)
    await withTransaction(async (session) => {
      const filter = { user: user._id }
      await Promise.all([
        Account.deleteMany(filter, { session }), Budget.deleteMany(filter, { session }), Expense.deleteMany(filter, { session }), Income.deleteMany(filter, { session }),
        RecurringRule.deleteMany(filter, { session }), RecurringOccurrence.deleteMany(filter, { session }), Notification.deleteMany(filter, { session }), Receipt.deleteMany(filter, { session }),
        Transfer.deleteMany(filter, { session }), Reconciliation.deleteMany(filter, { session }), SavingsGoal.deleteMany(filter, { session }), SavingsGoalEntry.deleteMany(filter, { session }), CustomCategory.deleteMany(filter, { session }),
        User.deleteOne({ _id: user._id }, { session }),
      ])
    })
    await Promise.all(receiptNames.map((storageName) => removeReceipt(storageName)))
    clearAuthCookie(res)
    return res.json({ message: 'Account deleted permanently', retentionPolicy: 'Personal records and locally stored receipt files are deleted immediately. No restore is available.' })
  } catch (_error) { return res.status(500).json({ message: 'Unable to delete account' }) }
}

module.exports = { changePassword, currentUser, deleteAccount, login, logout, register, updatePreferences, updateProfile }
