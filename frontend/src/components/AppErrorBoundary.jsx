import { Component } from 'react'

class AppErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-slate-100">
        <section className="max-w-md rounded-2xl border border-red-900/80 bg-slate-900 p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Something went wrong</p>
          <h1 className="mt-3 text-2xl font-semibold text-white">This page could not be displayed</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">Refresh the page to try again. Your saved data is not affected.</p>
          <button className="mt-6 rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300" type="button" onClick={() => window.location.reload()}>Refresh page</button>
        </section>
      </main>
    )
  }
}

export default AppErrorBoundary
