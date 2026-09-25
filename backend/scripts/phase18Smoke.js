const assert = require('node:assert/strict')
const dotenv = require('dotenv')
const mongoose = require('mongoose')
const connectDatabase = require('../config/database')
const User = require('../models/User')
const { Account } = require('../models/Account')

dotenv.config()
const baseUrl = 'http://localhost:5000'
const stamp = Date.now()
const credentials = { name: 'Phase Eighteen User', email: `phase18-${stamp}@example.invalid`, password: 'PhasePass123!' }

async function request(path, options = {}, cookie = '') {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) } })
  const text = await response.text(); let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = { raw: text } }
  const setCookie = response.headers.get('set-cookie')
  return { status: response.status, data, cookie: setCookie ? setCookie.split(';')[0] : cookie }
}
async function expect(label, promise, status) { const result = await promise; assert.equal(result.status, status, `${label}: expected ${status}, received ${result.status}`); return result }

async function run() {
  let userId
  try {
    const registered = await expect('register', request('/api/auth/register', { method: 'POST', body: JSON.stringify({ ...credentials, confirmPassword: credentials.password }) }), 201)
    userId = registered.data.user.id
    let cookie = registered.cookie
    const profile = await expect('profile update', request('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ name: 'Updated Phase User' }) }, cookie), 200)
    assert.equal(profile.data.user.name, 'Updated Phase User')
    const preferences = await expect('preferences update', request('/api/auth/preferences', { method: 'PATCH', body: JSON.stringify({ preferences: { theme: 'dark', dateFormat: 'YYYY-MM-DD' }, notificationPreferences: { budgetAlerts: false, recurringAlerts: true } }) }, cookie), 200)
    assert.equal(preferences.data.user.preferences.theme, 'dark')
    const category = (await expect('custom category', request('/api/categories', { method: 'POST', body: JSON.stringify({ name: 'Pets', type: 'expense' }) }, cookie), 201)).data.category
    const account = (await expect('account', request('/api/accounts', { method: 'POST', body: JSON.stringify({ name: 'Phase Account', type: 'Cash', openingBalance: 100 }) }, cookie), 201)).data.account
    await expect('custom category transaction', request('/api/expenses', { method: 'POST', body: JSON.stringify({ amount: 10, category: 'Pets', description: 'Pet food', date: new Date().toISOString().slice(0, 10), paymentMethod: 'Cash', account: account._id }) }, cookie), 201)
    await expect('category ownership', request(`/api/categories/${category._id}`, { method: 'PUT', body: JSON.stringify({ name: 'Should fail' }) }), 401)
    const warning = await expect('archive warning', request(`/api/accounts/${account._id}/archive`, { method: 'PATCH' }, cookie), 409)
    assert.equal(warning.data.requiresConfirmation, true)
    await expect('confirmed archive', request(`/api/accounts/${account._id}/archive`, { method: 'PATCH', body: JSON.stringify({ confirm: true }) }, cookie), 200)
    const changed = await expect('change password', request('/api/auth/password', { method: 'POST', body: JSON.stringify({ currentPassword: credentials.password, newPassword: 'NewPhasePass123!', confirmPassword: 'NewPhasePass123!' }) }, cookie), 200)
    cookie = changed.cookie
    await expect('old session revoked', request('/api/auth/me', {}, registered.cookie), 401)
    await expect('delete confirmation required', request('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ password: 'NewPhasePass123!', confirmation: 'no' }) }, cookie), 400)
    await expect('delete account', request('/api/auth/account', { method: 'DELETE', body: JSON.stringify({ password: 'NewPhasePass123!', confirmation: 'DELETE' }) }, cookie), 200)
    assert.equal(await User.exists({ _id: userId }), null)
    console.log('Phase 18 smoke test passed')
  } finally {
    if (userId) { await Account.deleteMany({ user: userId }); await User.deleteOne({ _id: userId }) }
    await mongoose.disconnect()
  }
}

connectDatabase().then(run).catch((error) => { console.error(error); process.exitCode = 1 })
