import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCurrency } from '../utils/expenseOptions'

function IncomeVsExpenseChart({ data }) {
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-900/80 p-5 shadow-lg shadow-black/10 sm:p-6"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Cash flow</p><h2 className="mt-2 text-xl font-semibold tracking-tight text-white">Income versus expenses</h2><div className="mt-6 h-72 min-w-0"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 8 }}><CartesianGrid stroke="#dce7e2" vertical={false} /><XAxis dataKey="label" tick={{ fill: '#71847c', fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fill: '#71847c', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `INR ${value}`} /><Tooltip contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #dce7e2', borderRadius: '10px' }} formatter={(value) => [formatCurrency(value)]} /><Legend /><Bar dataKey="income" name="Income" fill="#047857" radius={[4, 4, 0, 0]} /><Bar dataKey="expenses" name="Expenses" fill="#d97706" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
}

export default IncomeVsExpenseChart
