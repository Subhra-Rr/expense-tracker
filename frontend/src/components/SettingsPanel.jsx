import { useEffect, useState } from 'react'
import useAuth from '../context/useAuth'
import useTheme from '../context/ThemeContext'
import api from '../services/api'
import { errorMessage } from '../utils/errorMessage'

const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'

function SettingsPanel({ onDeleted }) {
  const { user, updateUser } = useAuth()
  const { setThemePreference } = useTheme()
  const [name, setName] = useState(user?.name || '')
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [preferences, setPreferences] = useState(user?.preferences || { currency: 'INR', dateFormat: 'DD/MM/YYYY', dashboardMonth: 'current', theme: 'system' })
  const [notificationPreferences, setNotificationPreferences] = useState(user?.notificationPreferences || { budgetAlerts: true, recurringAlerts: true })
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState({ name: '', type: 'expense' })
  const [deleteForm, setDeleteForm] = useState({ password: '', confirmation: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { api.get('/categories').then(({ data }) => setCategories(data.categories)).catch(() => {}) }, [])

  async function saveProfile(event) {
    event.preventDefault(); setError(''); setMessage('')
    try { const { data } = await api.patch('/auth/profile', { name }); updateUser({ ...user, ...data.user }); setMessage('Profile updated') } catch (requestError) { setError(errorMessage(requestError, 'Unable to update profile')) }
  }

  async function savePassword(event) {
    event.preventDefault(); setError(''); setMessage('')
    try { const { data } = await api.post('/auth/password', passwords); updateUser({ ...user, ...data.user }); setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' }); setMessage('Password changed') } catch (requestError) { setError(errorMessage(requestError, 'Unable to change password')) }
  }

  async function savePreferences(event) {
    event.preventDefault(); setError(''); setMessage('')
    try { const { data } = await api.patch('/auth/preferences', { preferences, notificationPreferences }); updateUser({ ...user, ...data.user }); setThemePreference(preferences.theme); setMessage('Preferences saved') } catch (requestError) { setError(errorMessage(requestError, 'Unable to save preferences')) }
  }

  async function addCategory(event) {
    event.preventDefault(); setError('')
    try { const { data } = await api.post('/categories', newCategory); setCategories((current) => [...current, data.category].sort((a, b) => a.name.localeCompare(b.name))); setNewCategory({ ...newCategory, name: '' }) } catch (requestError) { setError(errorMessage(requestError, 'Unable to create category')) }
  }

  async function archiveCategory(category) {
    try { await api.patch(`/categories/${category._id}/archive`); setCategories((current) => current.map((item) => item._id === category._id ? { ...item, archived: true } : item)) } catch (requestError) { setError(errorMessage(requestError, 'Unable to archive category')) }
  }

  async function renameCategory(category) {
    const name = window.prompt('Rename category', category.name)
    if (!name || name.trim() === category.name) return
    try { const { data } = await api.put(`/categories/${category._id}`, { name: name.trim() }); setCategories((current) => current.map((item) => item._id === category._id ? data.category : item)) } catch (requestError) { setError(errorMessage(requestError, 'Unable to rename category')) }
  }

  async function deleteAccount(event) {
    event.preventDefault(); setError('')
    if (!window.confirm('This permanently deletes your records and receipts. Continue?')) return
    try { await api.delete('/auth/account', { data: deleteForm }); onDeleted() } catch (requestError) { setError(errorMessage(requestError, 'Unable to delete account')) }
  }

  return <section className="mt-8 border-t border-slate-200 pt-8 dark:border-slate-800" id="settings">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">Account controls</p><h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">Settings</h2></div><p className="text-sm text-slate-500 dark:text-slate-400">{message}</p></div>
    {error && <p className="mt-4 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
    <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <form onSubmit={saveProfile} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-950 dark:text-white">Profile</h3><label className="block text-sm font-medium">Display name<input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="block text-sm font-medium">Email<input className={`${inputClass} opacity-60`} value={user?.email || ''} readOnly /></label><button className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">Save profile</button></form>
      <form onSubmit={savePassword} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-950 dark:text-white">Change password</h3>{[['currentPassword', 'Current password'], ['newPassword', 'New password'], ['confirmPassword', 'Confirm new password']].map(([key, label]) => <label className="block text-sm font-medium" key={key}>{label}<input className={inputClass} type="password" value={passwords[key]} onChange={(event) => setPasswords({ ...passwords, [key]: event.target.value })} required /></label>)}<button className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">Change password</button></form>
      <form onSubmit={savePreferences} className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-950 dark:text-white">Preferences</h3><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Currency<select className={inputClass} value={preferences.currency} onChange={(event) => setPreferences({ ...preferences, currency: event.target.value })}><option>INR</option></select></label><label className="text-sm font-medium">Date format<select className={inputClass} value={preferences.dateFormat} onChange={(event) => setPreferences({ ...preferences, dateFormat: event.target.value })}><option>DD/MM/YYYY</option><option>YYYY-MM-DD</option><option>MMM D, YYYY</option></select></label><label className="text-sm font-medium">Dashboard month<select className={inputClass} value={preferences.dashboardMonth} onChange={(event) => setPreferences({ ...preferences, dashboardMonth: event.target.value })}><option value="current">Current month</option><option value="previous">Previous month</option></select></label><label className="text-sm font-medium">Theme<select className={inputClass} value={preferences.theme} onChange={(event) => setPreferences({ ...preferences, theme: event.target.value })}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationPreferences.budgetAlerts} onChange={(event) => setNotificationPreferences({ ...notificationPreferences, budgetAlerts: event.target.checked })} /> Budget alerts</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={notificationPreferences.recurringAlerts} onChange={(event) => setNotificationPreferences({ ...notificationPreferences, recurringAlerts: event.target.checked })} /> Recurring alerts</label><button className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950" type="submit">Save preferences</button></form>
      <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h3 className="font-semibold text-slate-950 dark:text-white">Custom categories</h3><form onSubmit={addCategory} className="flex flex-wrap gap-2"><input className={`${inputClass} mt-0 min-w-[12rem] flex-1`} placeholder="Category name" value={newCategory.name} onChange={(event) => setNewCategory({ ...newCategory, name: event.target.value })} required /><select className={`${inputClass} mt-0 w-auto`} value={newCategory.type} onChange={(event) => setNewCategory({ ...newCategory, type: event.target.value })}><option value="expense">Expense</option><option value="income">Income</option></select><button className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950" type="submit">Add</button></form><div className="space-y-2">{categories.filter((category) => !category.archived).map((category) => <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm dark:border-slate-800" key={category._id}><span>{category.name} <span className="text-slate-500">({category.type})</span></span><div className="flex gap-3"><button className="text-xs font-semibold text-cyan-700" type="button" onClick={() => renameCategory(category)}>Rename</button><button className="text-xs font-semibold text-red-600" type="button" onClick={() => archiveCategory(category)}>Archive</button></div></div>)}</div></div>
    </div>
    <form onSubmit={deleteAccount} className="mt-5 rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-950 dark:bg-red-950/20"><h3 className="font-semibold text-red-800 dark:text-red-300">Delete account permanently</h3><p className="mt-1 text-sm text-red-700 dark:text-red-300">Personal records and stored receipts are deleted immediately. This cannot be undone.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><input className={`${inputClass} mt-0`} type="password" placeholder="Current password" value={deleteForm.password} onChange={(event) => setDeleteForm({ ...deleteForm, password: event.target.value })} required /><input className={`${inputClass} mt-0`} placeholder="Type DELETE" value={deleteForm.confirmation} onChange={(event) => setDeleteForm({ ...deleteForm, confirmation: event.target.value })} required /></div><button className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white" type="submit">Delete my account</button></form>
  </section>
}

export default SettingsPanel
