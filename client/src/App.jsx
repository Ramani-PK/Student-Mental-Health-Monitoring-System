import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import AdminDashboard from './pages/AdminDashboard'
import CounselorDashboard from './pages/CounselorDashboard'

function Protected({ roles, children }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/" />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />
  return children
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/student" element={
            <Protected roles={['student']}>
              <StudentDashboard />
            </Protected>
          } />



          <Route path="/admin" element={
            <Protected roles={['admin']}>
              <AdminDashboard />
            </Protected>
          } />

          <Route path="/counselor" element={
            <Protected roles={['counselor']}>
              <CounselorDashboard />
            </Protected>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
