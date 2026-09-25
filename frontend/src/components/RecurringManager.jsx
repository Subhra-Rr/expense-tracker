import { useEffect, useState } from 'react'
import api from '../services/api'
import { errorMessage } from '../utils/errorMessage'
import { categories, paymentMethods, today } from '../utils/expenseOptions'
import { incomeCategories } from '../utils/incomeOptions'

const frequencies = ['Daily', 'Weekly', 'Monthly', 'Yearly']

function emptyForm() { return { transactionType: 'Expense', title: '', amount: '', category: 'Food', account: '', frequency: 'Monthly', startDate: today(), endDate: '', paymentMethod: 'Other', timezone: 'Asia/Kolkata' } }
function formValues(rule) { return rule ? { transactionType: rule.transactionType, title: rule.title, amount: rule.amount, category: rule.category, account: rule.account?._id || rule.account, frequency: rule.frequency, startDate: new Date(rule.startDate).toISOString().slice(0, 10), endDate: rule.endDate ? new Date(rule.endDate).toISOString().slice(0, 10) : '', paymentMethod: rule.paymentMethod || 'Other', timezone: rule.timezone || 'Asia/Kolkata' } : emptyForm() }

function RecurringManager({ accounts }) {
  const [rules, setRules] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [history, setHistory] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const activeAccounts = accounts.filter((account) => !account.archived)
  const availableCategories = form.transactionType === 'Expense' ? categories : incomeCategories

  async function loadRules() {
    try { const { data } = await api.get('/recurring'); setRules(data.rules); setError('') } catch (requestError) { setError(errorMessage(requestError, 'Unable to load recurring rules')) } finally { setLoading(false) }
  }
  useEffect(() => { void loadRules() }, [])

  function update(event) {
    const next = { ...form, [event.target.name]: event.target.value }
    if (event.target.name === 'transactionType') next.category = event.target.value === 'Expense' ? 'Food' : 'Salary'
    setForm(next)
  }
  function edit(rule) { setEditingId(rule._id); setForm(formValues(rule)); setError(''); window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }) }
  function cancel() { setEditingId(null); setForm(emptyForm()); setError('') }

  async function submit(event) {
    event.preventDefault(); setSaving(true); setError('')
    try {
      if (editingId) await api.put(`/recurring/${editingId}`, { ...form, amount: Number(form.amount), endDate: form.endDate || undefined })
      else await api.post('/recurring', { ...form, amount: Number(form.amount), endDate: form.endDate || undefined })
      cancel(); await loadRules()
    } catch (requestError) { setError(errorMessage(requestError, 'Unable to save recurring rule')) } finally { setSaving(false) }
  }
  async function status(rule) {
    try { await api.patch(`/recurring/${rule._id}/status`, { status: rule.status === 'active' ? 'paused' : 'active' }); await loadRules() } catch (requestError) { setError(errorMessage(requestError, 'Unable to update recurring rule')) }
  }
  async function remove(rule) {
    if (!window.confirm(`Delete recurring rule "${rule.title}"? Generated transactions will remain.`)) return
    try { await api.delete(`/recurring/${rule._id}`); await loadRules() } catch (requestError) { setError(errorMessage(requestError, 'Unable to delete recurring rule')) }
  }
  async function showHistory(rule) {
    try { const { data } = await api.get(`/recurring/${rule._id}/history`); setHistory({ title: rule.title, rows: data.history }) } catch (requestError) { setError(errorMessage(requestError, 'Unable to load recurring history')) }
  }

  return <section className="mt-8 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg shadow-black/10 sm:p-8"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Automation</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Recurring transactions</h2></div><span className="text-sm text-slate-500">{rules.filter((rule) => rule.status === 'active').length} active</span></div>{error && <p className="mt-5 rounded-xl border border-red-900/80 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}<div className="mt-6 space-y-3">{loading ? <p className="py-6 text-sm text-slate-500">Loading recurring rules...</p> : rules.length === 0 ? <p className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">No recurring rules yet.</p> : rules.map((rule) => <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={rule._id}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{rule.title}</h3><span className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${rule.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{rule.status}</span></div><p className="mt-1 text-sm text-slate-500">{rule.transactionType} · {rule.category} · {rule.account?.name || 'Account unavailable'} · {rule.frequency}</p><p className="mt-2 text-sm font-medium text-emerald-700">Next due: {new Date(rule.nextDueDate).toLocaleDateString('en-IN')}</p>{rule.lastError && <p className="mt-2 text-sm text-red-600">{rule.lastError}</p>}</div><div className="flex flex-wrap gap-3 text-sm"><button className="font-semibold text-emerald-700" type="button" onClick={() => status(rule)}>{rule.status === 'active' ? 'Pause' : 'Resume'}</button><button className="font-semibold text-emerald-700" type="button" onClick={() => edit(rule)}>Edit</button><button className="font-semibold text-slate-600" type="button" onClick={() => showHistory(rule)}>History</button><button className="font-medium text-red-600" type="button" onClick={() => remove(rule)}>Delete</button></div></div></article>)}</div><form className="mt-7 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2 lg:grid-cols-4" onSubmit={submit}><label className="text-sm font-semibold text-slate-700">Type<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="transactionType" value={form.transactionType} onChange={update}><option>Expense</option><option>Income</option></select></label><label className="text-sm font-semibold text-slate-700">Title<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="title" maxLength="160" placeholder="Monthly rent" required value={form.title} onChange={update} /></label><label className="text-sm font-semibold text-slate-700">Amount<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="amount" type="number" min="0.01" step="0.01" required value={form.amount} onChange={update} /></label><label className="text-sm font-semibold text-slate-700">Category<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="category" value={form.category} onChange={update}>{availableCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Account<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="account" required value={form.account} onChange={update}><option value="">Choose an account</option>{activeAccounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Frequency<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="frequency" value={form.frequency} onChange={update}>{frequencies.map((frequency) => <option key={frequency}>{frequency}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Start date<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="startDate" type="date" required value={form.startDate} onChange={update} /></label><label className="text-sm font-semibold text-slate-700">End date<span className="ml-2 font-normal text-slate-500">Optional</span><input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="endDate" type="date" value={form.endDate} onChange={update} /></label>{form.transactionType === 'Expense' && <label className="text-sm font-semibold text-slate-700">Payment method<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" name="paymentMethod" value={form.paymentMethod} onChange={update}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>}<div className="flex items-end gap-2 lg:col-span-4"><button className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={saving || activeAccounts.length === 0} type="submit">{saving ? 'Saving...' : editingId ? 'Save rule' : 'Add recurring rule'}</button>{editingId && <button className="rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-600" type="button" onClick={cancel}>Cancel</button>}</div></form>{history && <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><div className="flex items-center justify-between"><h3 className="font-semibold text-emerald-900">History: {history.title}</h3><button className="text-sm text-emerald-800" type="button" onClick={() => setHistory(null)}>Close</button></div>{history.rows.length === 0 ? <p className="mt-3 text-sm text-emerald-800">No generated transactions yet.</p> : <div className="mt-3 space-y-2">{history.rows.map((row) => <p className="text-sm text-emerald-900" key={row.occurrenceKey}>{new Date(row.scheduledDate).toLocaleDateString('en-IN')} - {row.status}</p>)}</div>}</div>}</section>
}

export default RecurringManager
