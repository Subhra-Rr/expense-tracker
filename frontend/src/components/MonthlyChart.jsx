import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../utils/expenseOptions'

function MonthlyChart({ data }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Six-month view</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Monthly spending</h2></div>
      {data.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No monthly spending yet.</p> : <div className="mt-6 h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}><CartesianGrid stroke="#1e293b" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `INR ${value}`} /><Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '10px' }} labelStyle={{ color: '#e2e8f0' }} formatter={(value) => [formatCurrency(value), 'Spent']} /><Bar dataKey="amount" fill="#a5b4fc" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
    </section>
  )
}

export default MonthlyChart

