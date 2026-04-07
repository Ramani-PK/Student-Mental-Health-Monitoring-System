import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const { register } = useAuth()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    console.log('Submitting registration form:', { name, email, role })
    setError('')
    setLoading(true)
    try {
      const r = await register(name, email, password, role)
      console.log('Registration successful, navigating...', r)
      if (r.role === 'student') nav('/student')
      else if (r.role === 'counselor') nav('/counselor')
      else nav('/admin')
    } catch (err) {
      console.error('Form submission error:', err)
      const msg = err.response?.data?.error || err.message
      if (msg === 'email_in_use') setError('This email is already registered')
      else if (msg === 'missing_fields') setError('Please fill in all fields')
      else setError('Registration failed: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-100 to-brand-300">
      <form onSubmit={onSubmit} className="bg-white rounded-xl shadow-lg w-full max-w-md p-8 space-y-4">
        <h1 className="text-2xl font-bold text-brand-700 text-center">Create account</h1>
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <div>
          <label className="block text-sm mb-1">Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input value={email} onChange={e=>setEmail(e.target.value)} type="email" className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Password</label>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" className="w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400" required />
        </div>
        <div>
          <label className="block text-sm mb-1">Role</label>
          <select value={role} onChange={e=>setRole(e.target.value)} className="w-full border rounded-md px-3 py-2">
            <option value="student">Student</option>
            <option value="counselor">Counselor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-md py-2">
          {loading ? 'Creating...' : 'Create account'}
        </button>
        <div className="text-center text-sm">
          <a href="/" className="text-brand-700">Back to login</a>
        </div>
      </form>
    </div>
  )
}
