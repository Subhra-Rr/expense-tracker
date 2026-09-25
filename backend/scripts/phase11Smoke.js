const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const { Income } = require('../models/Income')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Eleven One', email: `phase11-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Eleven Two', email: `phase11-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
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
  const date = new Date().toISOString().slice(0, 10)
  try {
    const registeredOne = await expect('register user one', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[0], confirmPassword: users[0].password }) }), 201)
    userOneId = registeredOne.data.user.id
    const loginOne = await expect('login user one', request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: users[0].email, password: users[0].password }) }), 200)
    const cookieOne = loginOne.cookie
    const registeredTwo = await expect('register user two', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[1], confirmPassword: users[1].password }) }), 201)
    userTwoId = registeredTwo.data.user.id
    const cookieTwo = (await expect('login user two', request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: users[1].email, password: users[1].password }) }), 200)).cookie

    const accountOne = (await expect('create account one', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Primary Cash', type: 'Cash', openingBalance: 1000 }) }, cookieOne), 201)).data.account
    const accountTwo = (await expect('create account two', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Main Bank', type: 'Bank Account', openingBalance: 200 }) }, cookieOne), 201)).data.account
    const ownAccounts = await expect('list own accounts', request('/api/accounts', {}, cookieOne), 200)
    assert.equal(ownAccounts.data.accounts.length, 2)
    const otherAccounts = await expect('other user accounts isolated', request('/api/accounts', {}, cookieTwo), 200)
    assert.equal(otherAccounts.data.accounts.length, 0)
    await expect('unauthorized account update', request(`/api/accounts/${accountOne._id}`, { method: 'PUT', body: JSON.stringify({ name: 'Stolen', type: 'Cash' }) }, cookieTwo), 404)

    const idempotencyKey = `phase11-income-${stamp}`
    const income = await expect('create income', request('/api/incomes', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ amount: 500, source: 'Salary', category: 'Salary', date, account: accountOne._id, notes: '' }) }, cookieOne), 201)
    const duplicateIncome = await expect('duplicate income request', request('/api/incomes', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ amount: 500, source: 'Salary', category: 'Salary', date, account: accountOne._id, notes: '' }) }, cookieOne), 200)
    assert.equal(duplicateIncome.data.income._id, income.data.income._id)
    let accounts = (await expect('balance after income', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((account) => account._id === accountOne._id).currentBalance, 1500)
    const updatedIncome = await expect('edit income and move account', request(`/api/incomes/${income.data.income._id}`, { method: 'PUT', body: JSON.stringify({ amount: 300, source: 'Freelance', category: 'Freelance', date, account: accountTwo._id, notes: 'Updated' }) }, cookieOne), 200)
    assert.equal(updatedIncome.data.income.amount, 300)
    accounts = (await expect('balances after income edit', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((account) => account._id === accountOne._id).currentBalance, 1000)
    assert.equal(accounts.find((account) => account._id === accountTwo._id).currentBalance, 500)

    const expense = await expect('create linked expense', request('/api/expenses', { method: 'POST', headers: { 'Idempotency-Key': `phase11-expense-${stamp}` }, body: JSON.stringify({ amount: 250, category: 'Food', description: 'Linked expense', date, paymentMethod: 'Cash', account: accountOne._id, notes: '' }) }, cookieOne), 201)
    accounts = (await expect('balance after expense', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((account) => account._id === accountOne._id).currentBalance, 750)
    await expect('edit linked expense', request(`/api/expenses/${expense.data.expense._id}`, { method: 'PUT', body: JSON.stringify({ amount: 100, category: 'Food', description: 'Linked expense updated', date, paymentMethod: 'Cash', account: accountTwo._id, notes: '' }) }, cookieOne), 200)
    accounts = (await expect('balances after expense edit', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((account) => account._id === accountOne._id).currentBalance, 1000)
    assert.equal(accounts.find((account) => account._id === accountTwo._id).currentBalance, 400)
    await expect('delete linked expense', request(`/api/expenses/${expense.data.expense._id}`, { method: 'DELETE' }, cookieOne), 200)
    await expect('delete income', request(`/api/incomes/${income.data.income._id}`, { method: 'DELETE' }, cookieOne), 200)
    accounts = (await expect('balances after deletes', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((account) => account._id === accountOne._id).currentBalance, 1000)
    assert.equal(accounts.find((account) => account._id === accountTwo._id).currentBalance, 200)

    const finalIncome = await expect('create dashboard income', request('/api/incomes', { method: 'POST', body: JSON.stringify({ amount: 400, source: 'Pocket money', category: 'Pocket Money', date, account: accountOne._id, notes: '' }) }, cookieOne), 201)
    const finalExpense = await expect('create dashboard expense', request('/api/expenses', { method: 'POST', body: JSON.stringify({ amount: 150, category: 'Bills', description: 'Dashboard expense', date, paymentMethod: 'UPI', account: accountOne._id, notes: '' }) }, cookieOne), 201)
    const dashboard = await expect('dashboard income and cash flow', request('/api/dashboard/stats', {}, cookieOne), 200)
    assert.equal(dashboard.data.incomeSummary.total, 400)
    assert.equal(dashboard.data.summary.total, 150)
    assert.equal(dashboard.data.cashFlow, 250)
    assert.equal(dashboard.data.accountBalances.length, 2)
    assert.equal(dashboard.data.incomeVsExpense.length, 6)
    await expect('unauthorized income access', request(`/api/incomes/${finalIncome.data.income._id}`, {}, cookieTwo), 404)
    await expect('unauthorized expense access', request(`/api/expenses/${finalExpense.data.expense._id}`, {}, cookieTwo), 404)
    console.log('PHASE 11 LIVE SMOKE TEST PASSED')
  } finally {
    await mongoose.connect(process.env.MONGODB_URI)
    const ids = [userOneId, userTwoId].filter(Boolean).map((id) => new mongoose.Types.ObjectId(id))
    if (ids.length) {
      await Income.deleteMany({ user: { $in: ids } })
      await Expense.deleteMany({ user: { $in: ids } })
      await Account.deleteMany({ user: { $in: ids } })
    }
    await User.deleteMany({ email: { $in: users.map((user) => user.email) } })
    await mongoose.disconnect()
  }
}

run().catch((error) => { console.error('PHASE 11 LIVE SMOKE TEST FAILED:', error.message); process.exitCode = 1 })
