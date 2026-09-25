import { formatCurrency } from '../utils/expenseOptions'

function SummaryCards({ summary, incomeSummary, cashFlow, loading }) {
  const cards = [
    { label: 'Income this month', value: formatCurrency(incomeSummary.total) },
    { label: 'Total this month', value: formatCurrency(summary.total) },
    { label: 'Net cash flow', value: formatCurrency(cashFlow) },
    { label: 'Expenses this month', value: summary.count.toLocaleString('en-IN') },
    { label: 'Average expense', value: formatCurrency(summary.average) },
    { label: 'Highest expense', value: formatCurrency(summary.highest) },
  ]

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6" aria-label="Monthly summary">
      {cards.map((card) => (
        <article className="rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg shadow-black/10" key={card.label}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
          <p className="mt-4 truncate text-2xl font-semibold tracking-tight text-white" title={loading ? 'Loading' : card.value}>{loading ? '...' : card.value}</p>
        </article>
      ))}
    </section>
  )
}

export default SummaryCards
