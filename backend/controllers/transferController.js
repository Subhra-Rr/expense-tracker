const mongoose = require('mongoose')
const { Account } = require('../models/Account')
const Transfer = require('../models/Transfer')
const withTransaction = require('../utils/transaction')

function ready(res) { if (mongoose.connection.readyState !== 1) { res.status(503).json({ message: 'Database unavailable' }); return false } return true }
function validId(id) { return mongoose.Types.ObjectId.isValid(id) }
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  const [year, month, day] = value.split('-').map(Number)
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null
}
function validateTransfer(body) {
  const amount = Number(body?.amount)
  if (!validId(body?.sourceAccount) || !validId(body?.destinationAccount)) return 'Choose valid source and destination accounts'
  if (body.sourceAccount === body.destinationAccount) return 'Source and destination accounts must be different'
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000000) return 'Transfer amount must be greater than zero'
  if (!parseDate(body?.date)) return 'Choose a valid transfer date'
  if (typeof body?.notes !== 'undefined' && (typeof body.notes !== 'string' || body.notes.length > 500)) return 'Notes cannot exceed 500 characters'
  return null
}

async function listTransfers(req, res) {
  if (!ready(res)) return undefined
  try { const transfers = await Transfer.find({ user: req.user._id }).populate('sourceAccount destinationAccount', 'name type').sort({ date: -1, createdAt: -1 }).limit(100); return res.status(200).json({ transfers }) } catch (_error) { return res.status(500).json({ message: 'Unable to load transfers' }) }
}
async function createTransfer(req, res) {
  const error = validateTransfer(req.body)
  if (error) return res.status(400).json({ message: error })
  if (!ready(res)) return undefined
  const idempotencyKey = typeof req.headers['idempotency-key'] === 'string' ? req.headers['idempotency-key'].slice(0, 120) : undefined
  try {
    const result = await withTransaction(async (session) => {
      if (idempotencyKey) {
        const existing = await Transfer.findOne({ user: req.user._id, idempotencyKey }).populate('sourceAccount destinationAccount', 'name type').session(session)
        if (existing) return { transfer: existing, duplicate: true }
      }
      const source = await Account.findOne({ _id: req.body.sourceAccount, user: req.user._id, archived: false, currentBalance: { $gte: Number(req.body.amount) } }).session(session)
      const destination = await Account.findOne({ _id: req.body.destinationAccount, user: req.user._id, archived: false }).session(session)
      if (!source) throw Object.assign(new Error('Source account not found or has insufficient funds'), { status: 400 })
      if (!destination) throw Object.assign(new Error('Destination account not found or archived'), { status: 404 })
      const [transfer] = await Transfer.create([{ sourceAccount: source._id, destinationAccount: destination._id, amount: Number(req.body.amount), date: parseDate(req.body.date), notes: typeof req.body.notes === 'string' ? req.body.notes.trim() : '', user: req.user._id, ...(idempotencyKey ? { idempotencyKey } : {}) }], { session })
      await Account.updateOne({ _id: source._id, user: req.user._id }, { $inc: { currentBalance: -transfer.amount } }, { session })
      await Account.updateOne({ _id: destination._id, user: req.user._id }, { $inc: { currentBalance: transfer.amount } }, { session })
      await transfer.populate('sourceAccount destinationAccount', 'name type')
      return { transfer, duplicate: false }
    })
    return res.status(result.duplicate ? 200 : 201).json({ transfer: result.transfer })
  } catch (error) { return res.status(error.status || (error.code === 11000 ? 409 : 500)).json({ message: error.status ? error.message : error.code === 11000 ? 'This transfer was already processed' : 'Unable to create transfer' }) }
}

module.exports = { createTransfer, listTransfers, validateTransfer }
