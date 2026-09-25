import { useState } from 'react'
import api from '../services/api'
import { formatCurrency } from '../utils/expenseOptions'
import { errorMessage } from '../utils/errorMessage'

function BudgetCard({ data, loading, error, onSaved }) {
  const [amount, setAmount] = useState(data.budget?.amount || '')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const progress = Math.min(Math.max(data.percentageUsed, 0), 100)
  const overBudget = data.remaining < 0

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Enter a budget greater than zero')
      return
    }
    setSaving(true)
    try {
      const { data: response } = await api.put('/budget/current', { amount: numericAmount })
      setAmount(response.budget.amount)
      onSaved(response.budget)
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Unable to save budget'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg shadow-black/10 sm:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Monthly budget</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Stay on track</h2><p className="mt-2 text-sm text-slate-400">Set a limit for your current month.</p></div>
        <form className="flex w-full max-w-sm gap-2" onSubmit={handleSubmit}><label className="sr-only" htmlFor="monthly-budget">Monthly budget amount</label><input className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none focus:border-cyan-400" id="monthly-budget" type="number" min="0.01" step="0.01" placeholder="INR 20,000" value={amount} onChange={(event) => setAmount(event.target.value)} /><button className="rounded-xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60" disabled={saving} type="submit">{saving ? 'Saving...' : data.budget ? 'Update' : 'Set budget'}</button></form>
      </div>
      {error && <p className="mt-5 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
      {formError && <p className="mt-5 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{formError}</p>}
      <div className="mt-8 grid gap-5 sm:grid-cols-3"><div><p className="text-sm text-slate-400">Budget</p><p className="mt-2 text-xl font-semibold text-white">{loading ? '...' : data.budget ? formatCurrency(data.budget.amount) : 'Not set'}</p></div><div><p className="text-sm text-slate-400">Spent</p><p className="mt-2 text-xl font-semibold text-white">{loading ? '...' : formatCurrency(data.spent)}</p></div><div><p className="text-sm text-slate-400">Remaining</p><p className={`mt-2 text-xl font-semibold ${overBudget ? 'text-red-300' : 'text-white'}`}>{loading ? '...' : data.budget ? formatCurrency(data.remaining) : 'Set a budget'}</p></div></div>
      <div className="mt-7"><div className="mb-2 flex justify-between text-sm"><span className="text-slate-400">Percentage used</span><span className={overBudget ? 'text-red-300' : 'text-slate-300'}>{loading ? '...' : `${Math.round(data.percentageUsed)}%`}</span></div><div className="h-3 overflow-hidden rounded-full bg-slate-800"><div className={`h-full rounded-full transition-all ${overBudget ? 'bg-red-400' : 'bg-cyan-400'}`} style={{ width: `${loading ? 0 : progress}%` }} /></div></div>
    </section>
  )
}

export default BudgetCard
