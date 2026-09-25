import { Link, Outlet } from 'react-router-dom'
import ThemeToggle from '../components/ThemeToggle'

function AuthLayout() {
  return (
    <main className="auth-shell min-h-screen px-5 py-5 text-slate-900 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-6xl flex-col sm:min-h-[calc(100vh-4rem)]">
        <header className="auth-header flex items-center justify-between">
          <Link className="flex items-center gap-3 text-sm font-bold tracking-tight text-slate-900" to="/login">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-700 font-bold text-white">P</span>
            <span>Personal Expense Tracker</span>
          </Link>
          <div className="flex items-center gap-3"><span className="hidden text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 sm:block">Private by design</span><ThemeToggle /></div>
        </header>
        <div className="auth-stage grid flex-1 items-center gap-12 py-10 lg:grid-cols-[0.9fr_1fr] lg:gap-20 lg:py-16">
          <div className="hidden lg:block">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-700">A clearer financial routine</p>
            <h1 className="mt-5 max-w-lg text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-slate-900">Know where your money goes.</h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-slate-600">Track everyday spending, set a monthly limit, and make better decisions with less noise.</p>
            <div className="mt-10 flex items-center gap-3 text-sm font-medium text-slate-600"><span className="h-px w-10 bg-emerald-600" />Simple by design</div>
          </div>
          <div className="flex justify-center lg:justify-end"><Outlet /></div>
        </div>
      </div>
    </main>
  )
}

export default AuthLayout
