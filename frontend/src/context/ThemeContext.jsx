import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const ThemeContext = createContext(null)

function getInitialTheme() {
  const saved = window.localStorage.getItem('expense-tracker-theme')
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('expense-tracker-theme', theme)
  }, [theme])
  const value = useMemo(() => ({ theme, setTheme, setThemePreference: (preference) => setTheme(preference === 'dark' || preference === 'light' ? preference : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')), toggleTheme: () => setTheme((current) => current === 'dark' ? 'light' : 'dark') }), [theme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export default function useTheme() { return useContext(ThemeContext) }
