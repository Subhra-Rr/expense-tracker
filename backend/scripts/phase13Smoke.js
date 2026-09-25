const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const dotenv = require('dotenv')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')
const { Expense } = require('../models/Expense')
const Receipt = require('../models/Receipt')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const users = [
  { name: 'Phase Thirteen One', email: `phase13-one-${stamp}@example.invalid`, password: 'PhasePass123!' },
  { name: 'Phase Thirteen Two', email: `phase13-two-${stamp}@example.invalid`, password: 'PhasePass123!' },
]

async function request(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } })
  const text = await response.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  const setCookie = response.headers.get('set-cookie')
  return { status: response.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie, body: response.arrayBuffer }
}

async function expect(label, promise, status) {
  const result = await promise
  assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}`)
  return result
}

async function run() {
  let userOneId
  let userTwoId
  let expenseId
  try {
    userOneId = (await expect('register one', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[0], confirmPassword: users[0].password }) }), 201)).data.user.id
    const cookieOne = (await expect('login one', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[0]) }), 200)).cookie
    userTwoId = (await expect('register two', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...users[1], confirmPassword: users[1].password }) }), 201)).data.user.id
    const cookieTwo = (await expect('login two', request('/api/auth/login', { method: 'POST', body: JSON.stringify(users[1]) }), 200)).cookie
    const account = (await expect('create account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Receipt Account', type: 'Cash', openingBalance: 500 }) }, cookieOne), 201)).data.account
    const expense = await expect('create without receipt', request('/api/expenses', { method: 'POST', body: JSON.stringify({ amount: 25, category: 'Shopping', description: 'Receipt test', merchant: 'Acme Store', tags: ['work', 'office'], date: '2026-09-25', paymentMethod: 'Cash', account: account._id, notes: 'Keep invoice' }) }, cookieOne), 201)
    expenseId = expense.data.expense._id
    const filtered = await expect('merchant and tags filter', request('/api/expenses?merchant=acme&tags=work,office', {}, cookieOne), 200)
    assert.equal(filtered.data.pagination.totalExpenses, 1)
    await expect('edit without receipt', request(`/api/expenses/${expenseId}`, { method: 'PUT', body: JSON.stringify({ amount: 30, category: 'Shopping', description: 'Receipt test edited', merchant: 'Acme Store', tags: ['office'], date: '2026-09-25', paymentMethod: 'Cash', account: account._id, notes: 'Edited' }) }, cookieOne), 200)

    const invalid = new FormData()
    invalid.append('receipt', new Blob([Buffer.from('plain text, not an image')], { type: 'image/jpeg' }), 'fake.jpg')
    await expect('reject invalid image content', request(`/api/expenses/${expenseId}/receipt`, { method: 'POST', body: invalid }, cookieOne), 400)
    const uploaded = await expect('upload valid receipt', request(`/api/expenses/${expenseId}/receipt`, { method: 'POST', body: (() => { const form = new FormData(); form.append('receipt', new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' }), 'receipt.jpg'); return form })() }, cookieOne), 200)
    assert.equal(uploaded.data.receipt.contentType, 'image/jpeg')
    const viewed = await fetch(`${baseUrl}/api/expenses/${expenseId}/receipt`, { headers: { Cookie: cookieOne } })
    assert.equal(viewed.status, 200)
    assert.equal(viewed.headers.get('content-type'), 'image/jpeg')
    await expect('receipt ownership restriction', request(`/api/expenses/${expenseId}/receipt`, {}, cookieTwo), 404)
    const oversized = new FormData()
    oversized.append('receipt', new Blob([Buffer.alloc(5 * 1024 * 1024 + 1)], { type: 'image/png' }), 'large.png')
    await expect('reject oversized receipt', request(`/api/expenses/${expenseId}/receipt`, { method: 'POST', body: oversized }, cookieOne), 413)
    await expect('delete receipt', request(`/api/expenses/${expenseId}/receipt`, { method: 'DELETE' }, cookieOne), 200)
    await expect('receipt no longer available', request(`/api/expenses/${expenseId}/receipt`, {}, cookieOne), 404)
    console.log('Phase 13 smoke test passed')
  } finally {
    if (userOneId) {
      await Receipt.deleteMany({ user: userOneId })
      await Expense.deleteMany({ user: userOneId })
      await Account.deleteMany({ user: userOneId })
      await User.deleteOne({ _id: userOneId })
    }
    if (userTwoId) await User.deleteOne({ _id: userTwoId })
    await mongoose.disconnect()
  }
}

connectDatabase().then(run).catch((error) => { console.error(error); process.exitCode = 1 })
