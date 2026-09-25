import { formatCurrency, formatDate } from '../utils/expenseOptions'

function RecentExpenses({ expenses }) {
  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6">
      <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">Latest activity</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Recent expenses</h2></div><span className="text-xs text-slate-500">{expenses.length} shown</span></div>
      {expenses.length === 0 ? <p className="py-12 text-center text-sm text-slate-400">No expenses yet.</p> : <div className="mt-6 divide-y divide-slate-800">{expenses.map((expense) => <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" key={expense._id}><div className="min-w-0"><p className="truncate font-medium text-white">{expense.description}</p><p className="mt-1 text-sm text-slate-400">{formatDate(expense.date)} - {expense.category}</p></div><p className="shrink-0 font-semibold text-white">{formatCurrency(expense.amount)}</p></div>)}</div>}
    </section>
  )
}

export default RecentExpenses

