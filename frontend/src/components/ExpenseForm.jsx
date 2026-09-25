import { useState } from 'react'
import { categories, paymentMethods, today } from '../utils/expenseOptions'

function formValues(expense) {
  if (!expense) return { amount: '', category: 'Food', description: '', date: today(), paymentMethod: 'Cash', account: '', merchant: '', tags: '', notes: '', receipt: null, existingReceipt: null }
  return { amount: expense.amount, category: expense.category, description: expense.description, date: new Date(expense.date).toISOString().slice(0, 10), paymentMethod: expense.paymentMethod, account: expense.account?._id || expense.account || '', merchant: expense.merchant || '', tags: (expense.tags || []).join(', '), notes: expense.notes || '', receipt: null, existingReceipt: expense.receipt || null }
}

function ExpenseForm({ accounts = [], initialExpense, error, submitting, onCancel, onSubmit }) {
  const [form, setForm] = useState(() => formValues(initialExpense))
  function updateField(event) { setForm({ ...form, [event.target.name]: event.target.value }) }
  function handleSubmit(event) { event.preventDefault(); onSubmit({ ...form, amount: Number(form.amount), tags: form.tags.split(',').map((tag) => tag.trim()).filter(Boolean) }) }

  const activeAccounts = accounts.filter((account) => !account.archived)

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-6 shadow-lg shadow-black/10 sm:p-8">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{initialExpense ? 'Update record' : 'New record'}</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{initialExpense ? 'Edit expense' : 'Add an expense'}</h2></div>{initialExpense && <button className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white" type="button" onClick={onCancel}>Cancel</button>}</div>
      {error && <p className="mt-5 rounded-xl border border-red-900/80 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
      <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-300">Amount<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required value={form.amount} onChange={updateField} /></label>
        <label className="text-sm font-medium text-slate-300">Date<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="date" type="date" required value={form.date} onChange={updateField} /></label>
        <label className="text-sm font-medium text-slate-300">Category<select className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="category" value={form.category} onChange={updateField}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-300">Payment method<select className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="paymentMethod" value={form.paymentMethod} onChange={updateField}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-300 sm:col-span-2">Account<span className="ml-2 font-normal text-slate-500">{activeAccounts.length ? 'Required for balance tracking' : 'Optional for existing records'}</span><select className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="account" required={activeAccounts.length > 0} value={form.account} onChange={updateField}><option value="">{activeAccounts.length ? 'Choose an account' : 'No account selected'}</option>{activeAccounts.map((account) => <option key={account._id} value={account._id}>{account.name}</option>)}</select></label>
        <label className="text-sm font-medium text-slate-300 sm:col-span-2">Description<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="description" type="text" maxLength="160" placeholder="What was this expense for?" required value={form.description} onChange={updateField} /></label>
        <label className="text-sm font-medium text-slate-300">Merchant or payee<span className="ml-2 font-normal text-slate-500">Optional</span><input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="merchant" maxLength="160" placeholder="e.g. Amazon" value={form.merchant} onChange={updateField} /></label>
        <label className="text-sm font-medium text-slate-300">Tags<span className="ml-2 font-normal text-slate-500">Comma separated</span><input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="tags" maxLength="420" placeholder="work, travel" value={form.tags} onChange={updateField} /></label>
        <label className="text-sm font-medium text-slate-300 sm:col-span-2">Notes<span className="ml-2 font-normal text-slate-500">Optional</span><textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="notes" maxLength="500" placeholder="Add a little context" value={form.notes} onChange={updateField} /></label>
        <label className="text-sm font-medium text-slate-300 sm:col-span-2">Receipt image<span className="ml-2 font-normal text-slate-500">JPEG, PNG, or WebP; max 5 MB</span><input className="mt-2 block w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-400 file:px-3 file:py-2 file:font-semibold file:text-slate-950" name="receipt" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setForm({ ...form, receipt: event.target.files?.[0] || null })} />{form.existingReceipt && <span className="mt-2 block text-xs text-emerald-300">Receipt attached: {form.existingReceipt.originalName}</span>}</label>
        <button className="rounded-xl bg-cyan-400 px-4 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2" disabled={submitting} type="submit">{submitting ? 'Saving...' : initialExpense ? 'Save changes' : 'Add expense'}</button>
      </form>
    </section>
  )
}

export default ExpenseForm
