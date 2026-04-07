import { createContext, useContext, useEffect, useState } from 'react'
import axios from 'axios'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      setLoading(true)
      axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002'
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
      axios.get('/api/users/me')
        .then(r => setUser(r.data))
        .catch(() => {
          setUser(null)
          setToken(null)
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  async function login(email, password) {
    axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002'
    const r = await axios.post('/api/auth/login', { email, password })
    localStorage.setItem('token', r.data.token)
    setToken(r.data.token)
    setUser({ id: r.data.id, name: r.data.name, email: r.data.email, role: r.data.role })
    return r.data
  }

  async function register(name, email, password, role) {
    try {
      console.log('Registering user:', { name, email, role })
      axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4002'
      const r = await axios.post('/api/auth/register', { name, email, password, role })
      console.log('Registration response:', r.data)
      localStorage.setItem('token', r.data.token)
      setToken(r.data.token)
      setUser({ id: r.data.id, name: r.data.name, email: r.data.email, role: r.data.role })
      return r.data
    } catch (err) {
      console.error('Registration error details:', err.response?.data || err.message)
      throw err
    }
  }

  function logout() {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, register, setToken, setUser, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
