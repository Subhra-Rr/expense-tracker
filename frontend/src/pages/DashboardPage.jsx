import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CategoryChart from '../components/CategoryChart'
import AccountManager from '../components/AccountManager'
import BudgetCard from '../components/BudgetCard'
import ExpenseForm from '../components/ExpenseForm'
import ExpenseFilters from '../components/ExpenseFilters'
import ExpenseList from '../components/ExpenseList'
import MonthlyChart from '../components/MonthlyChart'
import NotificationCenter from '../components/NotificationCenter'
import IncomeForm from '../components/IncomeForm'
import IncomeList from '../components/IncomeList'
import IncomeVsExpenseChart from '../components/IncomeVsExpenseChart'
import RecurringManager from '../components/RecurringManager'
import RecentExpenses from '../components/RecentExpenses'
import ReportsPanel from '../components/ReportsPanel'
import SummaryCards from '../components/SummaryCards'
import SavingsGoals from '../components/SavingsGoals'
import ThemeToggle from '../components/ThemeToggle'
import TransfersAndReconciliation from '../components/TransfersAndReconciliation'
import SettingsPanel from '../components/SettingsPanel'
import useAuth from '../context/useAuth'
import api from '../services/api'
import { errorMessage } from '../utils/errorMessage'

const defaultFilters = { search: '', merchant: '', tags: '', category: '', paymentMethod: '', startDate: '', endDate: '', sort: 'newest', page: 1, limit: 10 }

function DashboardPage() {
  const { user, logout, clearSession } = useAuth()
  const navigate = useNavigate()
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editingExpense, setEditingExpense] = useState(null)
  const [filters, setFilters] = useState(defaultFilters)
  const [refreshKey, setRefreshKey] = useState(0)
  const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 0, totalExpenses: 0, limit: 10 })
  const [stats, setStats] = useState({ summary: { total: 0, count: 0, average: 0, highest: 0 }, incomeSummary: { total: 0, count: 0, average: 0, highest: 0 }, cashFlow: 0, categorySpending: [], monthlySpending: [], incomeVsExpense: [], recentExpenses: [] })
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [budget, setBudget] = useState({ budget: null, spent: 0, remaining: 0, percentageUsed: 0 })
  const [budgetLoading, setBudgetLoading] = useState(true)
  const [budgetError, setBudgetError] = useState('')
  const [accounts, setAccounts] = useState([])
  const [accountsError, setAccountsError] = useState('')
  const [incomes, setIncomes] = useState([])
  const [incomeLoading, setIncomeLoading] = useState(true)
  const [incomeError, setIncomeError] = useState('')
  const [incomeSubmitting, setIncomeSubmitting] = useState(false)
  const [incomeDeletingId, setIncomeDeletingId] = useState(null)
  const [editingIncome, setEditingIncome] = useState(null)
  const formRef = useRef(null)

  useEffect(() => {
    async function loadExpenses() {
      setLoading(true)
      try {
        const { data } = await api.get('/expenses', { params: filters })
        setExpenses(data.expenses)
        setPagination(data.pagination)
        setListError('')
      } catch (requestError) {
        setListError(errorMessage(requestError, 'Unable to load expenses'))
      } finally {
        setLoading(false)
      }
    }

    const delay = filters.search ? 250 : 0
    const timer = setTimeout(loadExpenses, delay)
    return () => clearTimeout(timer)
  }, [filters, refreshKey])

  useEffect(() => {
    async function loadStats() {
      try {
        const { data } = await api.get('/dashboard/stats')
        setStats(data)
      } catch (requestError) {
        setStatsError(errorMessage(requestError, 'Unable to load dashboard statistics'))
      } finally {
        setStatsLoading(false)
      }
    }

    loadStats()
  }, [])

  useEffect(() => {
    refreshBudget()
  }, [])

  useEffect(() => {
    refreshAccounts()
    refreshIncomes()
  }, [])

  async function refreshAccounts() {
    try {
      const { data } = await api.get('/accounts')
      setAccounts(data.accounts)
      setAccountsError('')
    } catch (requestError) { setAccountsError(errorMessage(requestError, 'Unable to load accounts')) }
  }

  async function refreshIncomes() {
    setIncomeLoading(true)
    try {
      const { data } = await api.get('/incomes', { params: { limit: 100 } })
      setIncomes(data.incomes)
      setIncomeError('')
    } catch (requestError) { setIncomeError(errorMessage(requestError, 'Unable to load income records')) } finally { setIncomeLoading(false) }
  }

  async function refreshStats() {
    try {
      const { data } = await api.get('/dashboard/stats')
      setStats(data)
      setStatsError('')
    } catch (requestError) {
      setStatsError(errorMessage(requestError, 'Unable to load dashboard statistics'))
    }
  }

  async function refreshBudget() {
    try {
      const { data } = await api.get('/budget/current')
      setBudget(data)
      setBudgetError('')
    } catch (requestError) {
      setBudgetError(errorMessage(requestError, 'Unable to load monthly budget'))
    } finally {
      setBudgetLoading(false)
    }
  }

  async function handleSubmit(expenseData) {
    setFormError('')
    setSubmitting(true)
    try {
      const { receipt, ...transactionData } = expenseData
      let savedExpense
      if (editingExpense) {
        savedExpense = (await api.put(`/expenses/${editingExpense._id}`, transactionData)).data.expense
        setEditingExpense(null)
      } else {
        savedExpense = (await api.post('/expenses', transactionData, { headers: { 'Idempotency-Key': crypto.randomUUID() } })).data.expense
      }
      if (receipt) {
        const receiptData = new FormData()
        receiptData.append('receipt', receipt)
        await api.post(`/expenses/${savedExpense._id}/receipt`, receiptData)
      }
      setRefreshKey((current) => current + 1)
      void refreshStats()
      void refreshBudget()
    } catch (requestError) {
      setFormError(errorMessage(requestError, 'Unable to save expense'))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoveReceipt(expense) {
    try {
      await api.delete(`/expenses/${expense._id}/receipt`)
      setRefreshKey((current) => current + 1)
    } catch (requestError) { setListError(errorMessage(requestError, 'Unable to remove receipt')) }
  }

  async function handleIncomeSubmit(incomeData) {
    setIncomeError(''); setIncomeSubmitting(true)
    try {
      if (editingIncome) {
        await api.put(`/incomes/${editingIncome._id}`, incomeData)
        setEditingIncome(null)
      } else {
        await api.post('/incomes', incomeData, { headers: { 'Idempotency-Key': crypto.randomUUID() } })
      }
      void refreshIncomes(); void refreshAccounts(); void refreshStats()
    } catch (requestError) { setIncomeError(errorMessage(requestError, 'Unable to save income')) } finally { setIncomeSubmitting(false) }
  }

  async function handleIncomeDelete(income) {
    if (!window.confirm(`Delete income "${income.source}"?`)) return
    setIncomeDeletingId(income._id)
    try { await api.delete(`/incomes/${income._id}`); void refreshIncomes(); void refreshAccounts(); void refreshStats() } catch (requestError) { setIncomeError(errorMessage(requestError, 'Unable to delete income')) } finally { setIncomeDeletingId(null) }
  }

  async function handleDelete(expense) {
    if (!window.confirm(`Delete "${expense.description}"?`)) return
    setListError('')
    setDeletingId(expense._id)
    try {
      await api.delete(`/expenses/${expense._id}`)
      if (editingExpense?._id === expense._id) setEditingExpense(null)
      setRefreshKey((current) => current + 1)
      void refreshStats()
      void refreshBudget()
    } catch (requestError) {
      setListError(errorMessage(requestError, 'Unable to delete expense'))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleDeleted() {
    clearSession()
    navigate('/login', { replace: true })
  }

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value, page: 1 }))
  }

  function resetFilters() {
    setFilters({ ...defaultFilters })
  }

  function changePage(page) {
    setFilters((current) => ({ ...current, page }))
  }

  return (
    <main className="dashboard-shell min-h-screen overflow-x-hidden bg-[#f3f6f4] px-4 py-5 text-slate-900 sm:px-8 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 border-b border-slate-800/90 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300"><span className="grid size-7 place-items-center rounded-lg bg-cyan-400 text-[11px] font-bold text-slate-950">P</span>Personal Expense Tracker</p><h1 className="mt-4 truncate text-3xl font-semibold tracking-tight text-white sm:text-4xl">Good to see you, {user?.name}</h1><p className="mt-2 truncate text-sm text-slate-400">{user?.email}</p></div>
          <nav className="flex w-full items-center gap-2 sm:w-auto" aria-label="Dashboard navigation"><ThemeToggle /><NotificationCenter /><button className="flex-1 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-950/20 transition hover:bg-cyan-300 sm:flex-none" type="button" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Add expense</button><button className="flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-red-400 hover:text-red-300 sm:flex-none" type="button" onClick={handleLogout}>Log out</button></nav>
        </header>
        {statsError && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{statsError}</p>}
        {accountsError && <p className="mt-6 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{accountsError}</p>}
        <div className="mt-8"><AccountManager accounts={accounts} onChanged={() => { void refreshAccounts(); void refreshStats() }} /></div>
        <TransfersAndReconciliation accounts={accounts} onChanged={() => { void refreshAccounts(); void refreshStats() }} />
        <SavingsGoals />
        <div className="mt-8"><BudgetCard key={budget.budget?.id || 'empty'} data={budget} loading={budgetLoading} error={budgetError} onSaved={() => { void refreshBudget() }} /></div>
        <div className="mt-8"><SummaryCards summary={stats.summary} incomeSummary={stats.incomeSummary} cashFlow={stats.cashFlow} loading={statsLoading} /></div>
        <div className="mt-8 grid gap-6 xl:grid-cols-2"><CategoryChart data={stats.categorySpending} /><MonthlyChart data={stats.monthlySpending} /><IncomeVsExpenseChart data={stats.incomeVsExpense} /></div>
        <ReportsPanel accounts={accounts} />
        <div className="mt-8"><RecentExpenses expenses={stats.recentExpenses} /></div>
        <div className="mt-8"><IncomeForm key={editingIncome?._id || 'new-income'} accounts={accounts} initialIncome={editingIncome} error={incomeError} submitting={incomeSubmitting} onCancel={() => { setEditingIncome(null); setIncomeError('') }} onSubmit={handleIncomeSubmit} /></div>
        <IncomeList incomes={incomes} loading={incomeLoading} error={incomeError} deletingId={incomeDeletingId} onEdit={(income) => { setIncomeError(''); setEditingIncome(income) }} onDelete={handleIncomeDelete} />
        <RecurringManager accounts={accounts} />
        <div className="mt-8" ref={formRef}><ExpenseForm key={editingExpense?._id || 'new'} accounts={accounts} initialExpense={editingExpense} error={formError} submitting={submitting} onCancel={() => { setEditingExpense(null); setFormError('') }} onSubmit={handleSubmit} /></div>
        <ExpenseFilters filters={filters} onChange={updateFilter} onReset={resetFilters} />
        <ExpenseList expenses={expenses} loading={loading} error={listError} deletingId={deletingId} pagination={pagination} onEdit={(expense) => { setFormError(''); setEditingExpense(expense) }} onDelete={handleDelete} onRemoveReceipt={handleRemoveReceipt} onPageChange={changePage} />
        <SettingsPanel onDeleted={handleDeleted} />
      </div>
    </main>
  )
}

export default DashboardPage
