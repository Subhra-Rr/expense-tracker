import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../utils/expenseOptions'

function CategoryChart({ data }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">By category</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Category spending</h2></div>
      {data.length === 0 ? <p className="py-16 text-center text-sm text-slate-400">No category spending this month.</p> : <div className="mt-6 h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}><CartesianGrid stroke="#dce7e2" vertical={false} /><XAxis dataKey="category" tick={{ fill: '#71847c', fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={55} /><YAxis tick={{ fill: '#71847c', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `INR ${value}`} /><Tooltip cursor={{ fill: '#eef5f1' }} contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #dce7e2', borderRadius: '10px' }} labelStyle={{ color: '#17312b' }} formatter={(value) => [formatCurrency(value), 'Spent']} /><Bar dataKey="amount" fill="#047857" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>}
    </section>
  )
}

export default CategoryChart
