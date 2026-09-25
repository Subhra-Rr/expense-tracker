const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const { Income } = require('../models/Income')
const { RecurringRule } = require('../models/RecurringRule')
const RecurringOccurrence = require('../models/RecurringOccurrence')
const { processDueRules } = require('../utils/recurringScheduler')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Twelve One', email: `phase12-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Twelve Two', email: `phase12-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
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

async function run() {
  let userOneId
  let userTwoId
  let ruleIds = []
  try {
    userOneId = (await expect('register one', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[0], confirmPassword: users[0].password }) }), 201)).data.user.id
    const cookieOne = (await expect('login one', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[0]) }), 200)).cookie
    userTwoId = (await expect('register two', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[1], confirmPassword: users[1].password }) }), 201)).data.user.id
    const cookieTwo = (await expect('login two', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[1]) }), 200)).cookie
    const account = (await expect('create account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Recurring Test Account', type: 'Cash', openingBalance: 1000 }) }, cookieOne), 201)).data.account

    const monthly = (await expect('create monthly income', request('/api/recurring', { method: 'POST', body: JSON.stringify({ transactionType: 'Income', title: 'Monthly salary', amount: 100, category: 'Salary', account: account._id, frequency: 'Monthly', startDate: '2024-01-15', timezone: 'Asia/Kolkata' }) }, cookieOne), 201)).data.rule
    ruleIds.push(monthly._id)
    const edited = (await expect('edit monthly income', request(`/api/recurring/${monthly._id}`, { method: 'PUT', body: JSON.stringify({ transactionType: 'Income', title: 'Edited salary', amount: 150, category: 'Salary', account: account._id, frequency: 'Monthly', startDate: '2024-01-15', timezone: 'Asia/Kolkata' }) }, cookieOne), 200)).data.rule
    assert.equal(edited.amount, 150)

    const yearly = (await expect('create yearly expense', request('/api/recurring', { method: 'POST', body: JSON.stringify({ transactionType: 'Expense', title: 'Yearly fee', amount: 40, category: 'Bills', paymentMethod: 'Cash', account: account._id, frequency: 'Yearly', startDate: '2024-02-29', timezone: 'Asia/Kolkata' }) }, cookieOne), 201)).data.rule
    ruleIds.push(yearly._id)
    const paused = (await expect('create paused rule', request('/api/recurring', { method: 'POST', body: JSON.stringify({ transactionType: 'Expense', title: 'Paused subscription', amount: 25, category: 'Entertainment', paymentMethod: 'Card', account: account._id, frequency: 'Monthly', startDate: '2024-01-01', timezone: 'Asia/Kolkata' }) }, cookieOne), 201)).data.rule
    ruleIds.push(paused._id)
    await expect('pause rule', request(`/api/recurring/${paused._id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'paused' }) }, cookieOne), 200)
    const ended = (await expect('create ended rule', request('/api/recurring', { method: 'POST', body: JSON.stringify({ transactionType: 'Income', title: 'Expired grant', amount: 75, category: 'Gift', account: account._id, frequency: 'Monthly', startDate: '2023-01-01', endDate: '2023-03-01', timezone: 'Asia/Kolkata' }) }, cookieOne), 201)).data.rule
    ruleIds.push(ended._id)

    const otherRules = await expect('rules isolated', request('/api/recurring', {}, cookieTwo), 200)
    assert.equal(otherRules.data.rules.length, 0)
    await expect('unauthorized rule update', request(`/api/recurring/${monthly._id}`, { method: 'PUT', body: JSON.stringify({ transactionType: 'Income', title: 'No', amount: 1, category: 'Salary', account: account._id, frequency: 'Monthly', startDate: '2024-01-15' }) }, cookieTwo), 404)
    await expect('unauthorized history', request(`/api/recurring/${monthly._id}/history`, {}, cookieTwo), 200)

    await processDueRules()
    await processDueRules()
    const history = await expect('monthly history', request(`/api/recurring/${monthly._id}/history`, {}, cookieOne), 200)
    assert.equal(history.data.history.length, 1, 'missed months must collapse to one occurrence')
    const yearlyHistory = await expect('yearly history', request(`/api/recurring/${yearly._id}/history`, {}, cookieOne), 200)
    assert.equal(yearlyHistory.data.history.length, 1)
    const pausedHistory = await expect('paused history', request(`/api/recurring/${paused._id}/history`, {}, cookieOne), 200)
    assert.equal(pausedHistory.data.history.length, 0)
    const expired = (await expect('list ended rule', request('/api/recurring', {}, cookieOne), 200)).data.rules.find((rule) => rule._id === ended._id)
    assert.equal(expired.status, 'cancelled')
    const balances = (await expect('balance after recurring generation', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(balances.find((item) => item._id === account._id).currentBalance, 1110)
    const generatedIncome = await Income.countDocuments({ user: userOneId, recurringRule: monthly._id })
    const generatedExpense = await Expense.countDocuments({ user: userOneId, recurringRule: yearly._id })
    assert.equal(generatedIncome, 1)
    assert.equal(generatedExpense, 1)
    await expect('delete paused rule', request(`/api/recurring/${paused._id}`, { method: 'DELETE' }, cookieOne), 200)
    console.log('Phase 12 smoke test passed')
  } finally {
    if (userOneId) {
      await RecurringOccurrence.deleteMany({ user: userOneId })
      await RecurringRule.deleteMany({ user: userOneId })
      await Expense.deleteMany({ user: userOneId })
      await Income.deleteMany({ user: userOneId })
      await Account.deleteMany({ user: userOneId })
      await User.deleteOne({ _id: userOneId })
    }
    if (userTwoId) await User.deleteOne({ _id: userTwoId })
    await mongoose.disconnect()
  }
}

connectDatabase().then(run).catch((error) => { console.error(error); process.exitCode = 1 })
