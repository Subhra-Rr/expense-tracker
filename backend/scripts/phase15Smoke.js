const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const { Income } = require('../models/Income')
const Budget = require('../models/Budget')
const { RecurringRule } = require('../models/RecurringRule')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Fifteen One', email: `phase15-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Fifteen Two', email: `phase15-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
]
async function request(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  const setCookie = response.headers.get('set-cookie')
  return { status: response.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie }
}
async function expect(label, promise, status) { const result = await promise; assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}`); return result }

async function run() {
  let userOneId
  let userTwoId
  try {
    userOneId = (await expect('register one', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[0], confirmPassword: users[0].password }) }), 201)).data.user.id
    const cookieOne = (await expect('login one', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[0]) }), 200)).cookie
    userTwoId = (await expect('register two', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[1], confirmPassword: users[1].password }) }), 201)).data.user.id
    const cookieTwo = (await expect('login two', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[1]) }), 200)).cookie
    const account = (await expect('create account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Reports Account', type: 'Cash', openingBalance: 1000 }) }, cookieOne), 201)).data.account
    const otherAccount = (await expect('create second account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Reports Bank', type: 'Bank Account', openingBalance: 500 }) }, cookieOne), 201)).data.account
    const date = new Date().toISOString().slice(0, 10)
    await expect('create formula expense', request('/api/expenses', { method: 'POST', body: JSON.stringify({ amount: 125, category: 'Food', description: '=SUM(A1:A2), lunch\nrow', date, paymentMethod: 'Cash', account: account._id, notes: 'quoted, note' }) }, cookieOne), 201)
    await expect('create second expense', request('/api/expenses', { method: 'POST', body: JSON.stringify({ amount: 75, category: 'Bills', description: 'Utilities', date, paymentMethod: 'Cash', account: otherAccount._id }) }, cookieOne), 201)
    await expect('create income', request('/api/incomes', { method: 'POST', body: JSON.stringify({ amount: 500, source: 'Salary', category: 'Salary', date, account: account._id }) }, cookieOne), 201)
    const report = await expect('filtered report', request(`/api/reports?startDate=${date}&endDate=${date}&account=${account._id}&category=Food`, {}, cookieOne), 200)
    assert.equal(report.data.summary.totalExpenses, 125)
    assert.equal(report.data.summary.totalIncome, 0)
    assert.equal(report.data.summary.transactionCount, 1)
    const empty = await expect('empty report', request('/api/reports?startDate=2020-01-01&endDate=2020-01-02', {}, cookieOne), 200)
    assert.equal(empty.data.summary.transactionCount, 0)
    const csv = await expect('filtered csv', request(`/api/reports/export.csv?startDate=${date}&endDate=${date}&account=${account._id}`, {}, cookieOne), 200)
    assert.match(csv.data.raw, /Date,Transaction type,Description,Category,Account,Amount,Payment method,Notes/)
    assert.match(csv.data.raw, /'=?SUM\(A1:A2\)/)
    assert.match(csv.data.raw, /"'=?SUM\(A1:A2\), lunch\nrow"/)
    assert.match(csv.data.raw, /Income/)
    const allCsv = await expect('all csv', request('/api/reports/export.csv?all=true', {}, cookieOne), 200)
    assert.equal((allCsv.data.raw.match(/,Expense,/g) || []).length, 2)
    assert.equal((allCsv.data.raw.match(/,Income,/g) || []).length, 1)
    const otherCsv = await expect('other user csv isolation', request(`/api/reports/export.csv?startDate=${date}&endDate=${date}`, {}, cookieTwo), 200)
    assert.equal(otherCsv.data.raw.trim().split('\n').length, 1)
    await expect('create budget for backup', request('/api/budget/current', { method: 'PUT', body: JSON.stringify({ amount: 900 }) }, cookieOne), 200)
    await expect('create recurring rule for backup', request('/api/recurring', { method: 'POST', body: JSON.stringify({ transactionType: 'Expense', title: 'Backup rule', amount: 20, category: 'Bills', paymentMethod: 'Cash', account: account._id, frequency: 'Monthly', startDate: date }) }, cookieOne), 201)
    const backup = await expect('json personal export', request('/api/reports/backup.json', {}, cookieOne), 200)
    assert.equal(backup.data.restorable, false)
    assert.equal(backup.data.data.accounts.length, 2)
    assert.equal(backup.data.data.expenses.length, 2)
    assert.equal(backup.data.data.incomes.length, 1)
    assert.equal(backup.data.data.budgets.length, 1)
    assert.equal(backup.data.data.recurringRules.length, 1)
    assert.equal(backup.data.data.savingsGoals.length, 0)
    assert.equal(Object.hasOwn(backup.data.data.expenses[0], 'user'), false)
    assert.equal(Object.hasOwn(backup.data.data.expenses[0], '_id'), false)
    assert.equal(Object.hasOwn(backup.data.data.accounts[0], '_id'), false)
    console.log('Phase 15 smoke test passed')
  } finally {
    if (userOneId) {
      await RecurringRule.deleteMany({ user: userOneId })
      await Budget.deleteMany({ user: userOneId })
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
