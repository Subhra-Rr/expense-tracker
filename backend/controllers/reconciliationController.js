const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const Reconciliation = require('../models/Reconciliation')
const withTransaction = require('../utils/transaction')

function ready(res) { if (mongoose.connection.readyState !== 1) { res.status(503).json({ message: 'Database unavailable' }); return false } return true }
function validId(id) { return mongoose.Types.ObjectId.isValid(id) }
function parseDate(value) { if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const date = new Date(`${value}T00:00:00.000Z`); const [year, month, day] = value.split('-').map(Number); return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null }
async function listReconciliations(req, res) { if (!ready(res)) return undefined; try { const records = await Reconciliation.find({ user: req.user._id }).populate('account', 'name type').sort({ reconciliationDate: -1, createdAt: -1 }).limit(100); return res.status(200).json({ reconciliations: records }) } catch (_error) { return res.status(500).json({ message: 'Unable to load reconciliations' }) } }
async function createReconciliation(req, res) {
  const statementBalance = Number(req.body?.statementBalance)
  if (!validId(req.body?.account)) return res.status(400).json({ message: 'Choose a valid account' })
  if (!Number.isFinite(statementBalance) || statementBalance < -1000000000000 || statementBalance > 1000000000000) return res.status(400).json({ message: 'Statement balance is invalid' })
  const date = parseDate(req.body?.reconciliationDate)
  if (!date) return res.status(400).json({ message: 'Choose a valid reconciliation date' })
  if (!ready(res)) return undefined
  try { const account = await Account.findOne({ _id: req.body.account, user: req.user._id }); if (!account) return res.status(404).json({ message: 'Account not found' }); const record = await Reconciliation.create({ account: account._id, user: req.user._id, recordedBalance: account.currentBalance, statementBalance, difference: statementBalance - account.currentBalance, reconciliationDate: date, notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : '' }); await record.populate('account', 'name type'); return res.status(201).json({ reconciliation: record }) } catch (_error) { return res.status(500).json({ message: 'Unable to create reconciliation' }) }
}
async function adjustReconciliation(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid reconciliation id' })
  if (typeof req.body?.reason !== 'string' || req.body.reason.trim().length < 3 || req.body.reason.length > 300) return res.status(400).json({ message: 'A reason of 3 to 300 characters is required' })
  if (!ready(res)) return undefined
  try {
    const result = await withTransaction(async (session) => {
      const record = await Reconciliation.findOne({ _id: req.params.id, user: req.user._id }).session(session)
      if (!record) throw Object.assign(new Error('Reconciliation not found'), { status: 404 })
      if (record.adjustedAt) throw Object.assign(new Error('This reconciliation has already been adjusted'), { status: 400 })
      const account = await Account.findOne({ _id: record.account, user: req.user._id, archived: false }).session(session)
      if (!account) throw Object.assign(new Error('Account not found or archived'), { status: 404 })
      const adjustmentAmount = record.statementBalance - account.currentBalance
      const updatedAccount = await Account.findOneAndUpdate({ _id: account._id, user: req.user._id }, { $inc: { currentBalance: adjustmentAmount } }, { new: true, session, runValidators: true })
      const updated = await Reconciliation.findOneAndUpdate({ _id: record._id, user: req.user._id }, { adjustmentAmount, balanceBeforeAdjustment: account.currentBalance, balanceAfterAdjustment: updatedAccount.currentBalance, adjustmentReason: req.body.reason.trim(), adjustedAt: new Date() }, { new: true, session }).populate('account', 'name type')
      return { reconciliation: updated, account: updatedAccount }
    })
    return res.status(200).json(result)
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to apply reconciliation adjustment' }) }
}

module.exports = { adjustReconciliation, createReconciliation, listReconciliations }
