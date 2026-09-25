const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const Budget = require('../models/Budget')
const Notification = require('../models/Notification')
const { RecurringRule } = require('../models/RecurringRule')
const { processDueRules } = require('../utils/recurringScheduler')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Fourteen One', email: `phase14-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Fourteen Two', email: `phase14-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
]

async function request(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  const setCookie = response.headers.get('set-cookie')
  return { status: response.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie }
}

async function expect(label, promise, status) {
  const result = await promise
  assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}`)
  return result
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

async function run() {
  let userOneId
  let userTwoId
  let expenseIds = []
  try {
    userOneId = (await expect('register one', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[0], confirmPassword: users[0].password }) }), 201)).data.user.id
    const cookieOne = (await expect('login one', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[0]) }), 200)).cookie
    userTwoId = (await expect('register two', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[1], confirmPassword: users[1].password }) }), 201)).data.user.id
    const cookieTwo = (await expect('login two', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[1]) }), 200)).cookie
    const account = (await expect('create account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Alert Account', type: 'Cash', openingBalance: 5000 }) }, cookieOne), 201)).data.account
    await expect('set budget', request('/api/budget/current', { method: 'PUT', body: JSON.stringify({ amount: 1000 }) }, cookieOne), 200)
    const date = new Date().toISOString().slice(0, 10)
    for (const [index, amount] of [500, 300, 200].entries()) {
      const expense = await expect(`create threshold expense ${index}`, request('/api/expenses', { method: 'POST', headers: { 'Idempotency-Key': `phase14-${stamp}-${index}` }, body: JSON.stringify({ amount, category: 'Bills', description: `Threshold ${index}`, date, paymentMethod: 'Cash', account: account._id }) }, cookieOne), 201)
      expenseIds.push(expense.data.expense._id)
      await wait(150)
    }
    const notifications = await expect('list notifications', request('/api/notifications', {}, cookieOne), 200)
    assert.equal(notifications.data.notifications.filter((item) => item.type === 'budget_threshold').length, 3)
    assert.equal(notifications.data.unreadCount, 3)
    const duplicateCheck = await expect('duplicate notification list', request('/api/notifications', {}, cookieOne), 200)
    assert.equal(duplicateCheck.data.notifications.length, 3)
    await expect('read one', request(`/api/notifications/${notifications.data.notifications[0]._id}/read`, { method: 'PATCH' }, cookieOne), 200)
    assert.equal((await expect('read count', request('/api/notifications', {}, cookieOne), 200)).data.unreadCount, 2)
    await expect('mark all read', request('/api/notifications/read-all', { method: 'PATCH' }, cookieOne), 200)
    assert.equal((await expect('all read count', request('/api/notifications', {}, cookieOne), 200)).data.unreadCount, 0)
    await expect('dismiss one', request(`/api/notifications/${notifications.data.notifications[0]._id}/dismiss`, { method: 'PATCH' }, cookieOne), 200)
    assert.equal((await expect('dismissed list', request('/api/notifications', {}, cookieOne), 200)).data.notifications.length, 2)

    await expect('disable budget preference', request('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ budgetAlerts: false, recurringAlerts: true }) }, cookieOne), 200)
    await expect('increase budget', request('/api/budget/current', { method: 'PUT', body: JSON.stringify({ amount: 5000 }) }, cookieOne), 200)
    await wait(150)
    assert.equal((await expect('preference state', request('/api/notifications/preferences', {}, cookieOne), 200)).data.preferences.budgetAlerts, false)
    assert.equal((await expect('user isolation', request('/api/notifications', {}, cookieTwo), 200)).data.notifications.length, 0)
    await expect('invalid preference', request('/api/notifications/preferences', { method: 'PUT', body: JSON.stringify({ budgetAlerts: 'yes', recurringAlerts: true }) }, cookieOne), 400)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    await expect('create recurring due rule', request('/api/recurring', { method: 'POST', body: JSON.stringify({ transactionType: 'Expense', title: 'Due soon test', amount: 20, category: 'Bills', paymentMethod: 'Cash', account: account._id, frequency: 'Monthly', startDate: tomorrow, timezone: 'Asia/Kolkata' }) }, cookieOne), 201)
    await processDueRules()
    const withRecurring = await expect('recurring due notification', request('/api/notifications', {}, cookieOne), 200)
    assert.equal(withRecurring.data.notifications.some((item) => item.type === 'recurring_due'), true)
    console.log('Phase 14 smoke test passed')
  } finally {
    if (userOneId) {
      await Notification.deleteMany({ user: userOneId })
      await RecurringRule.deleteMany({ user: userOneId })
      await Budget.deleteMany({ user: userOneId })
      await Expense.deleteMany({ user: userOneId })
      await Account.deleteMany({ user: userOneId })
      await User.deleteOne({ _id: userOneId })
    }
    if (userTwoId) await User.deleteOne({ _id: userTwoId })
    await mongoose.disconnect()
  }
}

connectDatabase().then(run).catch((error) => { console.error(error); process.exitCode = 1 })
