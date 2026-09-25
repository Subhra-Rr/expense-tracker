const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const { SavingsGoal } = require('../models/SavingsGoal')
const SavingsGoalEntry = require('../models/SavingsGoalEntry')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Sixteen One', email: `phase16-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Sixteen Two', email: `phase16-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
]
async function request(path, options = {}, cookie = '') { const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } }); const text = await response.text(); let data = null; try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }; const setCookie = response.headers.get('set-cookie'); return { status: response.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie } }
async function expect(label, promise, status) { const result = await promise; assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}`); return result }

async function run() {
  let userOneId
  let userTwoId
  try {
    userOneId = (await expect('register one', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[0], confirmPassword: users[0].password }) }), 201)).data.user.id
    const cookieOne = (await expect('login one', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[0]) }), 200)).cookie
    userTwoId = (await expect('register two', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[1], confirmPassword: users[1].password }) }), 201)).data.user.id
    const cookieTwo = (await expect('login two', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[1]) }), 200)).cookie
    const account = (await expect('create account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Goal Account', type: 'Cash', openingBalance: 1000 }) }, cookieOne), 201)).data.account
    const initialExpenses = (await expect('initial expenses', request('/api/expenses', {}, cookieOne), 200)).data.pagination.totalExpenses
    const goal = (await expect('create goal', request('/api/savings-goals', { method: 'POST', body: JSON.stringify({ name: 'New laptop', targetAmount: 500, targetDate: '2027-12-31', notes: 'Do not alter account balance' }) }, cookieOne), 201)).data.goal
    assert.equal(goal.currentSavedAmount, 0)
    await expect('reject zero target', request('/api/savings-goals', { method: 'POST', body: JSON.stringify({ name: 'Invalid', targetAmount: 0 }) }, cookieOne), 400)
    await expect('contribution', request(`/api/savings-goals/${goal._id}/entries`, { method: 'POST', body: JSON.stringify({ entryType: 'contribution', amount: 400, note: 'First save' }) }, cookieOne), 201)
    let current = (await expect('goal after contribution', request('/api/savings-goals', {}, cookieOne), 200)).data.goals[0]
    assert.equal(current.currentSavedAmount, 400)
    assert.equal(current.status, 'active')
    await expect('withdrawal', request(`/api/savings-goals/${goal._id}/entries`, { method: 'POST', body: JSON.stringify({ entryType: 'withdrawal', amount: 100 }) }, cookieOne), 201)
    await expect('reject excessive withdrawal', request(`/api/savings-goals/${goal._id}/entries`, { method: 'POST', body: JSON.stringify({ entryType: 'withdrawal', amount: 500 }) }, cookieOne), 400)
    await expect('positive correction completes goal', request(`/api/savings-goals/${goal._id}/entries`, { method: 'POST', body: JSON.stringify({ entryType: 'correction', amount: 1, delta: 200 }) }, cookieOne), 201)
    current = (await expect('completed goal', request('/api/savings-goals', {}, cookieOne), 200)).data.goals[0]
    assert.equal(current.currentSavedAmount, 500)
    assert.equal(current.status, 'completed')
    await expect('edit target recalculates status', request(`/api/savings-goals/${goal._id}`, { method: 'PUT', body: JSON.stringify({ name: 'New laptop updated', targetAmount: 1000, targetDate: '2028-01-01', notes: 'Updated' }) }, cookieOne), 200)
    current = (await expect('updated goal', request('/api/savings-goals', {}, cookieOne), 200)).data.goals[0]
    assert.equal(current.status, 'active')
    assert.equal(current.currentSavedAmount / current.targetAmount, 0.5)
    const history = await expect('history', request(`/api/savings-goals/${goal._id}/history`, {}, cookieOne), 200)
    assert.equal(history.data.entries.length, 3)
    assert.equal((await expect('goal isolation', request('/api/savings-goals', {}, cookieTwo), 200)).data.goals.length, 0)
    await expect('unauthorized goal history', request(`/api/savings-goals/${goal._id}/history`, {}, cookieTwo), 404)
    const accounts = (await expect('account unchanged', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((item) => item._id === account._id).currentBalance, 1000)
    assert.equal((await expect('expenses unchanged', request('/api/expenses', {}, cookieOne), 200)).data.pagination.totalExpenses, initialExpenses)
    await expect('archive goal', request(`/api/savings-goals/${goal._id}/archive`, { method: 'PATCH' }, cookieOne), 200)
    await expect('reject archived entry', request(`/api/savings-goals/${goal._id}/entries`, { method: 'POST', body: JSON.stringify({ entryType: 'contribution', amount: 1 }) }, cookieOne), 404)
    console.log('Phase 16 smoke test passed')
  } finally {
    if (userOneId) { await SavingsGoalEntry.deleteMany({ user: userOneId }); await SavingsGoal.deleteMany({ user: userOneId }); await Expense.deleteMany({ user: userOneId }); await Account.deleteMany({ user: userOneId }); await User.deleteOne({ _id: userOneId }) }
    if (userTwoId) await User.deleteOne({ _id: userTwoId })
    await mongoose.disconnect()
  }
}
connectDatabase().then(run).catch((error) => { console.error(error); process.exitCode = 1 })
