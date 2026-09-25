import useTheme from '../context/ThemeContext'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  return <button className="theme-toggle rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-cyan-300" type="button" aria-label={`Switch to ${nextTheme} mode`} onClick={toggleTheme}>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
}

export default ThemeToggle
