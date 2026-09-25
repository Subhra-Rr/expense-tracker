import { useState } from 'react'
import api from '../services/api'
import { errorMessage } from '../utils/errorMessage'
import { accountTypes, formatAccountBalance } from '../utils/accountOptions'

function AccountManager({ accounts, onChanged }) {
  const [form, setForm] = useState({ name: '', type: 'Cash', openingBalance: '' })
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function updateField(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  function startEdit(account) { setEditingId(account._id); setForm({ name: account.name, type: account.type, openingBalance: '' }); setError('') }
  function cancelEdit() { setEditingId(null); setForm({ name: '', type: 'Cash', openingBalance: '' }); setError('') }

  async function submit(event) {
    event.preventDefault(); setError(''); setSaving(true)
    try {
      if (editingId) {
        await api.put(`/accounts/${editingId}`, { name: form.name, type: form.type })
      } else {
        await api.post('/accounts', { ...form, openingBalance: Number(form.openingBalance) })
      }
      cancelEdit(); onChanged()
    } catch (requestError) { setError(errorMessage(requestError, 'Unable to save account')) } finally { setSaving(false) }
  }

  async function archive(account) {
    if (!window.confirm(`Archive "${account.name}"? Existing transactions will remain available.`)) return
    setError('')
    try { await api.patch(`/accounts/${account._id}/archive`); onChanged() } catch (requestError) {
      if (requestError.response?.status === 409 && requestError.response.data?.requiresConfirmation && window.confirm(`${requestError.response.data.message} Continue archiving?`)) {
        try { await api.patch(`/accounts/${account._id}/archive`, { confirm: true }); onChanged() } catch (confirmationError) { setError(errorMessage(confirmationError, 'Unable to archive account')) }
      } else setError(errorMessage(requestError, 'Unable to archive account'))
    }
  }

  const activeAccounts = accounts.filter((account) => !account.archived)
  const archivedAccounts = accounts.filter((account) => account.archived)

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg shadow-black/10 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Financial accounts</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Where your money lives</h2></div><span className="text-sm text-slate-500">{activeAccounts.length} active</span></div>
      {error && <p className="mt-5 rounded-xl border border-red-900/80 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activeAccounts.map((account) => <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={account._id}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-white">{account.name}</p><p className="mt-1 text-xs text-slate-500">{account.type}</p></div><p className="shrink-0 font-semibold text-white">{formatAccountBalance(account.currentBalance)}</p></div><div className="mt-4 flex gap-3 text-sm"><button className="font-semibold text-emerald-700 hover:text-emerald-800" type="button" onClick={() => startEdit(account)}>Edit</button><button className="font-medium text-red-600 hover:text-red-700" type="button" onClick={() => archive(account)}>Archive</button></div></article>)}</div>
      {archivedAccounts.length > 0 && <p className="mt-5 text-xs text-slate-500">{archivedAccounts.length} archived account{archivedAccounts.length === 1 ? '' : 's'} hidden from new transactions.</p>}
      <form className="mt-7 grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end" onSubmit={submit}><label className="text-sm font-semibold text-slate-700">Account name<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900" name="name" minLength="2" maxLength="80" placeholder="e.g. Main bank" required value={form.name} onChange={updateField} /></label><label className="text-sm font-semibold text-slate-700">Type<select className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900" name="type" value={form.type} onChange={updateField}>{accountTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{editingId ? <div /> : <label className="text-sm font-semibold text-slate-700">Opening balance<input className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900" name="openingBalance" type="number" min="0" step="0.01" required value={form.openingBalance} onChange={updateField} /></label>}<div className="flex gap-2"><button className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white hover:bg-emerald-800 disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving...' : editingId ? 'Save' : 'Add account'}</button>{editingId && <button className="rounded-xl border border-slate-300 px-4 py-3 font-medium text-slate-600" type="button" onClick={cancelEdit}>Cancel</button>}</div></form>
    </section>
  )
}

export default AccountManager
