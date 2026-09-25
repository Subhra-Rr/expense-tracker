import { createContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    api.get('/auth/me')
      .then(({ data }) => { if (active) setUser(data.user) })
      .catch(() => {
        if (active) {
          setUser(null)
        }
      })
      .finally(() => { if (active) setLoading(false) })

    return () => { active = false }
  }, [])

  function saveSession(session) {
    setUser(session.user)
  }

  function clearSession() {
    setUser(null)
  }

  function updateUser(nextUser) { setUser(nextUser) }

  async function login(credentials) {
    const { data } = await api.post('/auth/login', credentials)
    saveSession(data)
  }

  async function register(credentials) {
    const { data } = await api.post('/auth/register', credentials)
    saveSession(data)
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      clearSession()
    }
  }

  return <AuthContext.Provider value={{ loading, user, login, register, logout, updateUser, clearSession }}>{children}</AuthContext.Provider>
}

export { AuthContext, AuthProvider }
