const mongoose = require('mongoose')
const Notification = require('../models/Notification')
const User = require('../models/User')

function ready(res) { if (mongoose.connection.readyState !== 1) { res.status(503).json({ message: 'Database unavailable' }); return false } return true }

async function listNotifications(req, res) {
  if (!ready(res)) return undefined
  try {
    const notifications = await Notification.find({ user: req.user._id, dismissedAt: null }).sort({ createdAt: -1 }).limit(50)
    const unreadCount = await Notification.countDocuments({ user: req.user._id, dismissedAt: null, readAt: null })
    return res.status(200).json({ notifications, unreadCount })
  } catch (_error) { return res.status(500).json({ message: 'Unable to load notifications' }) }
}

async function markRead(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid notification id' })
  if (!ready(res)) return undefined
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id, dismissedAt: null }, { $set: { readAt: new Date() } }, { new: true })
  if (!notification) return res.status(404).json({ message: 'Notification not found' })
  return res.status(200).json({ notification })
}

async function markAllRead(req, res) {
  if (!ready(res)) return undefined
  await Notification.updateMany({ user: req.user._id, dismissedAt: null, readAt: null }, { $set: { readAt: new Date() } })
  return res.status(200).json({ message: 'Notifications marked as read' })
}

async function dismiss(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ message: 'Invalid notification id' })
  if (!ready(res)) return undefined
  const notification = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id, dismissedAt: null }, { $set: { dismissedAt: new Date(), readAt: new Date() } }, { new: true })
  if (!notification) return res.status(404).json({ message: 'Notification not found' })
  return res.status(200).json({ message: 'Notification dismissed' })
}

async function getPreferences(req, res) {
  if (!ready(res)) return undefined
  const user = await User.findById(req.user._id).select('notificationPreferences')
  return res.status(200).json({ preferences: user?.notificationPreferences || { budgetAlerts: true, recurringAlerts: true } })
}

async function updatePreferences(req, res) {
  const { budgetAlerts, recurringAlerts } = req.body || {}
  if (typeof budgetAlerts !== 'boolean' || typeof recurringAlerts !== 'boolean') return res.status(400).json({ message: 'Notification preferences must be boolean values' })
  if (!ready(res)) return undefined
  const user = await User.findByIdAndUpdate(req.user._id, { $set: { 'notificationPreferences.budgetAlerts': budgetAlerts, 'notificationPreferences.recurringAlerts': recurringAlerts } }, { new: true }).select('notificationPreferences')
  return res.status(200).json({ preferences: user.notificationPreferences })
}

module.exports = { dismiss, getPreferences, listNotifications, markAllRead, markRead, updatePreferences }
