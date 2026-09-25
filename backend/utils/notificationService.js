const Budget = require('../models/Budget')
const { Expense } = require('../models/Expense')
const Notification = require('../models/Notification')
const User = require('../models/User')

const budgetThresholds = [50, 80, 100]

function periodFor(date = new Date()) {
  return { month: date.getMonth() + 1, year: date.getFullYear(), start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 1) }
}

async function createBudgetNotifications(userId, date = new Date()) {
  const user = await User.findById(userId).select('notificationPreferences')
  if (user?.notificationPreferences?.budgetAlerts === false) return
  const period = periodFor(date)
  const [budget, spentRows] = await Promise.all([
    Budget.findOne({ user: userId, month: period.month, year: period.year }),
    Expense.aggregate([{ $match: { user: userId, date: { $gte: period.start, $lt: period.end } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ])
  if (!budget) return
  const spent = spentRows[0]?.total || 0
  const percentage = (spent / budget.amount) * 100
  const reached = budgetThresholds.filter((threshold) => percentage >= threshold)
  await Promise.all(reached.map((threshold) => Notification.updateOne(
    { uniqueKey: `budget:${userId}:${period.year}-${String(period.month).padStart(2, '0')}:${threshold}` },
    { $set: { message: `You have spent ${Math.round(percentage * 100) / 100}% of your monthly budget.`, metadata: { threshold, month: period.month, year: period.year, spent, budget: budget.amount } }, $setOnInsert: { user: userId, type: 'budget_threshold', title: `${threshold}% of monthly budget used` } },
    { upsert: true },
  )))
}

async function createRecurringDueNotification(rule, today = new Date()) {
  const user = await User.findById(rule.user).select('notificationPreferences')
  if (user?.notificationPreferences?.recurringAlerts === false) return
  const due = new Date(rule.nextDueDate)
  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / 86400000)
  if (daysUntil < 0 || daysUntil > 3) return
  const dueKey = due.toISOString().slice(0, 10)
  await Notification.updateOne(
    { uniqueKey: `recurring:${rule._id}:${dueKey}` },
    { $setOnInsert: { user: rule.user, type: 'recurring_due', title: `${rule.title} is due soon`, message: `${rule.transactionType} of INR ${rule.amount} is scheduled for ${dueKey}.`, metadata: { rule: rule._id, dueDate: dueKey } } },
    { upsert: true },
  )
}

module.exports = { createBudgetNotifications, createRecurringDueNotification, periodFor }
