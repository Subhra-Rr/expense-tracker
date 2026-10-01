import { useEffect, useMemo, useState } from 'react'
import ThemeContext from './theme-context'

function getInitialTheme() {
  const saved = window.localStorage.getItem('expense-tracker-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    root.classList.toggle('dark', theme === 'dark')
    window.localStorage.setItem('expense-tracker-theme', theme)
  }, [theme])
  const value = useMemo(() => ({ theme, setTheme, setThemePreference: (preference) => setTheme(preference === 'dark' || preference === 'light' ? preference : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')), toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

