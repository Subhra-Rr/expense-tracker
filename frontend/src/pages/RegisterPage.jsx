import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import useAuth from '../context/useAuth'
import { errorMessage } from '../utils/errorMessage'

function RegisterPage() {
  const { register, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/dashboard" replace />
  function updateField(event) { setForm({ ...form, [event.target.name]: event.target.value }) }

  async function handleSubmit(event) {
    event.preventDefault(); setError('')
    if (form.password !== form.confirmPassword) { setError('Passwords do not match'); return }
    setSubmitting(true)
    try {
      await register(form)
      navigate('/dashboard', { replace: true })
    } catch (requestError) {
      setError(errorMessage(requestError, 'Unable to create your account'))
    } finally { setSubmitting(false) }
  }

  return (
    <section className="auth-panel w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-9">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Get started</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Create your account</h1>
      <p className="mt-3 text-sm leading-6 text-slate-400">Set up a private place for your everyday spending.</p>
      {error && <p className="mt-6 rounded-xl border border-red-900/80 bg-red-950/40 p-3 text-sm text-red-200" role="alert">{error}</p>}
      <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-300">Name<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="name" type="text" autoComplete="name" placeholder="Your name" minLength="2" maxLength="80" required value={form.name} onChange={updateField} /></label>
        <label className="block text-sm font-medium text-slate-300">Email<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={form.email} onChange={updateField} /></label>
        <label className="block text-sm font-medium text-slate-300">Password<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="password" type="password" autoComplete="new-password" placeholder="At least 8 characters" minLength="8" maxLength="72" required value={form.password} onChange={updateField} /></label>
        <label className="block text-sm font-medium text-slate-300">Confirm password<input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-white placeholder:text-slate-600 outline-none transition focus:border-cyan-400 focus:bg-slate-950" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat your password" minLength="8" maxLength="72" required value={form.confirmPassword} onChange={updateField} /></label>
        <button className="w-full rounded-xl bg-cyan-400 px-4 py-3.5 font-semibold text-slate-950 shadow-lg shadow-cyan-950/30 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60" disabled={submitting} type="submit">{submitting ? 'Creating account...' : 'Create account'}</button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400">Already have an account? <Link className="font-medium text-cyan-300 hover:text-cyan-200" to="/login">Sign in</Link></p>
    </section>
  )
}

export default RegisterPage
