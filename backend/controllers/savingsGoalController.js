const mongoose = require('mongoose')
const withTransaction = require('../utils/transaction')
const { SavingsGoal, statuses } = require('../models/SavingsGoal')
const SavingsGoalEntry = require('../models/SavingsGoalEntry')

function ready(res) { if (mongoose.connection.readyState !== 1) { res.status(503).json({ message: 'Database unavailable' }); return false } return true }
function validId(id) { return mongoose.Types.ObjectId.isValid(id) }
function parseDate(value) {
  if (!value) return undefined
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  const [year, month, day] = value.split('-').map(Number)
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day ? date : null
}
function validateGoal(body) {
  const targetAmount = Number(body?.targetAmount)
  if (typeof body?.name !== 'string' || body.name.trim().length < 1 || body.name.trim().length > 120) return 'Goal name must be between 1 and 120 characters'
  if (!Number.isFinite(targetAmount) || targetAmount <= 0 || targetAmount > 1000000000000) return 'Target amount must be greater than zero'
  if (body?.notes !== undefined && (typeof body.notes !== 'string' || body.notes.length > 500)) return 'Notes cannot exceed 500 characters'
  if (body?.targetDate && !parseDate(body.targetDate)) return 'Choose a valid target date'
  return null
}
function goalData(body, user) { return { name: body.name.trim(), targetAmount: Number(body.targetAmount), targetDate: body.targetDate ? parseDate(body.targetDate) : undefined, notes: typeof body.notes === 'string' ? body.notes.trim() : '', user } }

async function getGoals(req, res) {
  if (!ready(res)) return undefined
  try { const goals = await SavingsGoal.find({ user: req.user._id }).sort({ status: 1, targetDate: 1, createdAt: -1 }); return res.status(200).json({ goals }) } catch (_error) { return res.status(500).json({ message: 'Unable to load savings goals' }) }
}
async function createGoal(req, res) {
  const error = validateGoal(req.body)
  if (error) return res.status(400).json({ message: error })
  if (!ready(res)) return undefined
  try { const goal = await SavingsGoal.create(goalData(req.body, req.user._id)); return res.status(201).json({ goal }) } catch (_error) { return res.status(500).json({ message: 'Unable to create savings goal' }) }
}
async function updateGoal(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid savings goal id' })
  const error = validateGoal(req.body)
  if (error) return res.status(400).json({ message: error })
  if (!ready(res)) return undefined
  try {
    const existing = await SavingsGoal.findOne({ _id: req.params.id, user: req.user._id })
    if (!existing) return res.status(404).json({ message: 'Savings goal not found' })
    const data = goalData(req.body, req.user._id)
    if (existing.status === 'archived') data.status = 'archived'
    else data.status = existing.currentSavedAmount >= data.targetAmount ? 'completed' : 'active'
    const goal = await SavingsGoal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, data, { new: true, runValidators: true })
    return res.status(200).json({ goal })
  } catch (_error) { return res.status(500).json({ message: 'Unable to update savings goal' }) }
}
async function archiveGoal(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid savings goal id' })
  if (!ready(res)) return undefined
  const goal = await SavingsGoal.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { status: 'archived' }, { new: true })
  if (!goal) return res.status(404).json({ message: 'Savings goal not found' })
  return res.status(200).json({ goal })
}
async function addEntry(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid savings goal id' })
  const entryType = req.body?.entryType
  const amount = entryType === 'correction' ? Math.abs(Number(req.body?.delta)) : Number(req.body?.amount)
  if (!['contribution', 'withdrawal', 'correction'].includes(entryType)) return res.status(400).json({ message: 'Choose a valid entry type' })
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000000000) return res.status(400).json({ message: 'Entry amount must be greater than zero' })
  if (typeof req.body?.note !== 'undefined' && (typeof req.body.note !== 'string' || req.body.note.length > 300)) return res.status(400).json({ message: 'Entry note cannot exceed 300 characters' })
  if (!ready(res)) return undefined
  try {
    const result = await withTransaction(async (session) => {
      const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user._id, status: { $ne: 'archived' } }).session(session)
      if (!goal) throw Object.assign(new Error('Savings goal not found or archived'), { status: 404 })
      const delta = entryType === 'contribution' ? amount : entryType === 'withdrawal' ? -amount : (req.body.delta === undefined ? amount : Number(req.body.delta))
      if (!Number.isFinite(delta) || delta === 0 || Math.abs(delta) > 1000000000000) throw Object.assign(new Error('Correction must have a valid non-zero delta'), { status: 400 })
      const updated = await SavingsGoal.findOneAndUpdate({ _id: goal._id, user: req.user._id, currentSavedAmount: { $gte: delta < 0 ? Math.abs(delta) : 0 } }, { $inc: { currentSavedAmount: delta }, $set: { status: goal.currentSavedAmount + delta >= goal.targetAmount ? 'completed' : 'active' } }, { new: true, runValidators: true, session })
      if (!updated || updated.currentSavedAmount < 0) throw Object.assign(new Error('Withdrawal or correction cannot reduce saved amount below zero'), { status: 400 })
      const [entry] = await SavingsGoalEntry.create([{ goal: goal._id, user: req.user._id, entryType, amount: delta, note: typeof req.body.note === 'string' ? req.body.note.trim() : '' }], { session })
      return { goal: updated, entry }
    })
    return res.status(201).json(result)
  } catch (error) { return res.status(error.status || 500).json({ message: error.status ? error.message : 'Unable to record savings goal entry' }) }
}
async function getHistory(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: 'Invalid savings goal id' })
  if (!ready(res)) return undefined
  const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user._id }).select('_id')
  if (!goal) return res.status(404).json({ message: 'Savings goal not found' })
  const entries = await SavingsGoalEntry.find({ goal: goal._id, user: req.user._id }).sort({ createdAt: -1 })
  return res.status(200).json({ entries })
}

module.exports = { addEntry, archiveGoal, createGoal, getGoals, getHistory, statuses, updateGoal, validateGoal }
