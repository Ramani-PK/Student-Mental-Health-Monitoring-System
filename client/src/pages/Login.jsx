import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const r = await login(email, password)
      if (r.role === 'student') nav('/student')
      else if (r.role === 'counselor') nav('/counselor')
      else nav('/admin')
    } catch (err) {
      console.error('Login error:', err)
      const msg = err.response?.data?.error || 'Invalid credentials'
      if (msg === 'not_found') setError('User not found')
      else if (msg === 'invalid_credentials') setError('Invalid email or password')
      else setError('Login failed: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300">
      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-lg w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-brand-700 text-center">Sign in</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" required />
        </div>
        <button disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-md py-2">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <div className="text-center text-sm">
          <a href="/register" className="text-brand-700">Create an account</a>
        </div>
      </form>
    </div>
  )
}
