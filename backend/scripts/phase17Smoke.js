const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const Transfer = require('../models/Transfer')
const Reconciliation = require('../models/Reconciliation')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Seventeen One', email: `phase17-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Seventeen Two', email: `phase17-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
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
    const source = (await expect('source account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Transfer Bank', type: 'Bank Account', openingBalance: 3000 }) }, cookieOne), 201)).data.account
    const destination = (await expect('destination account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Transfer Cash', type: 'Cash', openingBalance: 200 }) }, cookieOne), 201)).data.account
    const key = `phase17-transfer-${stamp}`
    const transfer = await expect('successful transfer', request('/api/transfers', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ sourceAccount: source._id, destinationAccount: destination._id, amount: 1000, date: new Date().toISOString().slice(0, 10), notes: 'Move cash' }) }, cookieOne), 201)
    const duplicate = await expect('duplicate transfer', request('/api/transfers', { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ sourceAccount: source._id, destinationAccount: destination._id, amount: 1000, date: new Date().toISOString().slice(0, 10) }) }, cookieOne), 200)
    assert.equal(duplicate.data.transfer._id, transfer.data.transfer._id)
    await expect('same account rejected', request('/api/transfers', { method: 'POST', body: JSON.stringify({ sourceAccount: source._id, destinationAccount: source._id, amount: 1, date: new Date().toISOString().slice(0, 10) }) }, cookieOne), 400)
    await expect('insufficient funds rejected', request('/api/transfers', { method: 'POST', body: JSON.stringify({ sourceAccount: source._id, destinationAccount: destination._id, amount: 99999, date: new Date().toISOString().slice(0, 10) }) }, cookieOne), 400)
    const accounts = (await expect('balanced accounts', request('/api/accounts', {}, cookieOne), 200)).data.accounts
    assert.equal(accounts.find((item) => item._id === source._id).currentBalance, 2000)
    assert.equal(accounts.find((item) => item._id === destination._id).currentBalance, 1200)
    const beforeExpenses = (await expect('expense count before report', request('/api/expenses', {}, cookieOne), 200)).data.pagination.totalExpenses
    const report = await expect('transfer excluded from reports', request('/api/reports?all=true', {}, cookieOne), 200)
    assert.equal(report.data.summary.transactionCount, beforeExpenses)
    await expect('create reconciliation', request('/api/reconciliations', { method: 'POST', body: JSON.stringify({ account: source._id, statementBalance: 2100, reconciliationDate: new Date().toISOString().slice(0, 10), notes: 'Bank statement' }) }, cookieOne), 201)
    const reconciliation = (await expect('reconciliation list', request('/api/reconciliations', {}, cookieOne), 200)).data.reconciliations[0]
    assert.equal(reconciliation.recordedBalance, 2000)
    assert.equal(reconciliation.difference, 100)
    await expect('adjustment requires reason', request(`/api/reconciliations/${reconciliation._id}/adjust`, { method: 'PATCH', body: JSON.stringify({ reason: 'x' }) }, cookieOne), 400)
    const adjusted = await expect('deliberate adjustment', request(`/api/reconciliations/${reconciliation._id}/adjust`, { method: 'PATCH', body: JSON.stringify({ reason: 'Bank fee correction' }) }, cookieOne), 200)
    assert.equal(adjusted.data.account.currentBalance, 2100)
    await expect('duplicate adjustment rejected', request(`/api/reconciliations/${reconciliation._id}/adjust`, { method: 'PATCH', body: JSON.stringify({ reason: 'Again' }) }, cookieOne), 400)
    assert.equal((await expect('other user transfer isolation', request('/api/transfers', {}, cookieTwo), 200)).data.transfers.length, 0)
    assert.equal((await expect('other user reconciliation isolation', request('/api/reconciliations', {}, cookieTwo), 200)).data.reconciliations.length, 0)
    console.log('Phase 17 smoke test passed')
  } finally {
    if (userOneId) { await Transfer.deleteMany({ user: userOneId }); await Reconciliation.deleteMany({ user: userOneId }); await Expense.deleteMany({ user: userOneId }); await Account.deleteMany({ user: userOneId }); await User.deleteOne({ _id: userOneId }) }
    if (userTwoId) await User.deleteOne({ _id: userTwoId })
    await mongoose.disconnect()
  }
}
connectDatabase().then(run).catch((error) => { console.error(error); process.exitCode = 1 })
