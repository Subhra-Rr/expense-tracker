import { formatCurrency, formatDate } from '../utils/expenseOptions'
import { useEffect, useState } from 'react'
import api from '../services/api'

function ReceiptViewer({ expense, onClose }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let objectUrl
    api.get(`/expenses/${expense._id}/receipt`, { responseType: 'blob' }).then(({ data }) => { objectUrl = URL.createObjectURL(data); setUrl(objectUrl) }).catch(() => setError('Unable to load this receipt.')).catch(() => {})
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [expense._id])
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4" role="dialog" aria-modal="true"><div className="max-h-[90vh] max-w-3xl rounded-2xl bg-white p-4"><div className="flex items-center justify-between gap-4"><h2 className="font-semibold text-slate-900">Receipt</h2><button className="text-sm font-medium text-slate-600" type="button" onClick={onClose}>Close</button></div>{error ? <p className="p-8 text-sm text-red-600">{error}</p> : url ? <img className="mt-4 max-h-[78vh] max-w-full object-contain" src={url} alt="Expense receipt" /> : <p className="p-8 text-sm text-slate-500">Loading receipt...</p>}</div></div>
}

function ExpenseActions({ expense, deletingId, onEdit, onDelete, onViewReceipt, onRemoveReceipt }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <button className="rounded-lg px-2 py-1 font-medium text-cyan-300 transition hover:bg-cyan-400/10 hover:text-cyan-200" type="button" onClick={() => onEdit(expense)}>Edit</button>
      {expense.receipt && <button className="rounded-lg px-2 py-1 font-medium text-emerald-300 transition hover:bg-emerald-400/10" type="button" onClick={() => onViewReceipt(expense)}>Receipt</button>}
      {expense.receipt && <button className="rounded-lg px-2 py-1 font-medium text-amber-300 transition hover:bg-amber-400/10" type="button" onClick={() => onRemoveReceipt(expense)}>Remove receipt</button>}
      <button className="rounded-lg px-2 py-1 font-medium text-red-300 transition hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={deletingId === expense._id} onClick={() => onDelete(expense)}>{deletingId === expense._id ? 'Deleting...' : 'Delete'}</button>
    </div>
  )
}

function ExpenseList({ expenses, loading, error, deletingId, pagination, onEdit, onDelete, onRemoveReceipt, onPageChange }) {
  const [viewingReceipt, setViewingReceipt] = useState(null)
  return (
    <section className="mt-8 rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">History</p><h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Your expenses</h2></div>
        <span className="text-xs text-slate-500">{pagination.totalExpenses} {pagination.totalExpenses === 1 ? 'entry' : 'entries'}</span>
      </div>
      {error && <p className="mt-5 rounded-xl border border-red-900/80 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
      {loading && <div className="py-14 text-center"><div className="mx-auto size-6 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-300" /><p className="mt-4 text-sm text-slate-400">Loading expenses...</p></div>}
      {!loading && expenses.length === 0 && <div className="py-14 text-center"><div className="mx-auto grid size-11 place-items-center rounded-2xl border border-slate-700 bg-slate-950 text-slate-500">--</div><p className="mt-4 font-medium text-slate-300">{pagination.totalExpenses === 0 ? 'No matching expenses' : 'No expenses on this page'}</p><p className="mt-1 text-sm text-slate-500">Try adjusting your filters or add a new expense.</p></div>}
      {!loading && expenses.length > 0 && <>
        <div className="mt-6 hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-[11px] uppercase tracking-[0.16em] text-slate-500"><tr><th className="pb-3 pr-4 font-semibold">Date</th><th className="pb-3 pr-4 font-semibold">Description</th><th className="pb-3 pr-4 font-semibold">Category</th><th className="pb-3 pr-4 font-semibold">Payment method</th><th className="pb-3 pr-4 text-right font-semibold">Amount</th><th className="pb-3 text-right font-semibold">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-800/80">{expenses.map((expense) => <tr key={expense._id} className="text-slate-300 transition hover:bg-slate-800/30"><td className="whitespace-nowrap py-4 pr-4 text-slate-400">{formatDate(expense.date)}</td><td className="max-w-[16rem] truncate py-4 pr-4 font-medium text-white">{expense.merchant || expense.description}</td><td className="py-4 pr-4">{expense.category}</td><td className="py-4 pr-4">{expense.paymentMethod}</td><td className="py-4 pr-4 text-right font-semibold text-white">{formatCurrency(expense.amount)}</td><td className="py-4 text-right"><div className="flex justify-end"><ExpenseActions expense={expense} deletingId={deletingId} onEdit={onEdit} onDelete={onDelete} onViewReceipt={setViewingReceipt} onRemoveReceipt={onRemoveReceipt} /></div></td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-5 space-y-3 md:hidden">{expenses.map((expense) => <article className="rounded-xl border border-slate-800 bg-slate-950/45 p-4" key={expense._id}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-semibold text-white">{expense.merchant || expense.description}</p><p className="mt-1 text-xs text-slate-500">{formatDate(expense.date)}</p></div><p className="shrink-0 font-semibold text-white">{formatCurrency(expense.amount)}</p></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3 text-sm"><div><dt className="text-xs text-slate-500">Category</dt><dd className="mt-1 text-slate-300">{expense.category}</dd></div><div><dt className="text-xs text-slate-500">Payment</dt><dd className="mt-1 text-slate-300">{expense.paymentMethod}</dd></div></dl><div className="mt-3 border-t border-slate-800 pt-3"><ExpenseActions expense={expense} deletingId={deletingId} onEdit={onEdit} onDelete={onDelete} onViewReceipt={setViewingReceipt} onRemoveReceipt={onRemoveReceipt} /></div></article>)}</div>
      </>}
      {!loading && pagination.totalPages > 1 && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-5"><button className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={pagination.currentPage === 1} onClick={() => onPageChange(pagination.currentPage - 1)}>Previous</button><span className="text-sm text-slate-400">Page {pagination.currentPage} of {pagination.totalPages}</span><button className="rounded-xl border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40" type="button" disabled={pagination.currentPage === pagination.totalPages} onClick={() => onPageChange(pagination.currentPage + 1)}>Next</button></div>}
      {viewingReceipt && <ReceiptViewer expense={viewingReceipt} onClose={() => setViewingReceipt(null)} />}
    </section>
  )
}

export default ExpenseList
