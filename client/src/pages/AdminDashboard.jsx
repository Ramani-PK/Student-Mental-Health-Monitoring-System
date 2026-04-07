import { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [users, setUsers] = useState([])
  const [alerts, setAlerts] = useState([])
  const [students, setStudents] = useState([])
  const [counselors, setCounselors] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [counselorSearch, setCounselorSearch] = useState('')
  
  // Selection states for details
  const [selectedCounselor, setSelectedCounselor] = useState(null)
  const [counselorResponses, setCounselorResponses] = useState([])
  const [loadingResponses, setLoadingResponses] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentJournal, setStudentJournal] = useState([])
  const [studentSuggestions, setStudentSuggestions] = useState([])
  const [loadingStudentData, setLoadingStudentData] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [alertNotes, setAlertNotes] = useState('')
  const [selectedAssessmentStudentId, setSelectedAssessmentStudentId] = useState('')
  const [assessmentHistory, setAssessmentHistory] = useState([])
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  const [dashboardStats, setDashboardStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    fetchUsers()
    fetchDashboardData()
    fetchDashboardStats()
    
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4002')
    socket.emit('joinRole', 'admin')
    socket.on('alert', a => setAlerts(prev => [a, ...prev]))
    return () => socket.disconnect()
  }, [])

  const fetchUsers = () => {
    axios.get('/api/users').then(r => setUsers(r.data))
  }

  const fetchDashboardData = () => {
      axios.get('/api/alerts').then(r => setAlerts(r.data))
      axios.get('/api/students').then(r => setStudents(r.data))
      axios.get('/api/counselors').then(r => setCounselors(r.data))
    }

    const fetchDashboardStats = () => {
      setLoadingStats(true)
      axios.get('/api/dashboard-stats')
        .then(r => {
          setDashboardStats(r.data)
          setLoadingStats(false)
        })
        .catch(() => setLoadingStats(false))
    }

    const updateAlertStatus = (id, status) => {
    axios.patch(`/api/alerts/${id}/status`, { status }).then(() => {
      fetchDashboardData()
    })
  }

  const alertStats = {
    active: alerts.filter(a => a.status !== 'Resolved').length,
    highRisk: alerts.filter(a => (a.risk === 'critical' || a.risk === 'high') && a.status !== 'Resolved').length,
    resolvedToday: alerts.filter(a => a.status === 'Resolved' && new Date(a.updatedAt).toDateString() === new Date().toDateString()).length
  }

  const deleteUser = (id) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      axios.delete(`/api/users/${id}`).then(() => fetchUsers())
    }
  }

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  )

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  )

  const filteredCounselors = counselors.filter(c => 
     c.name.toLowerCase().includes(counselorSearch.toLowerCase()) ||
     c.email.toLowerCase().includes(counselorSearch.toLowerCase())
   )

   const handleSelectCounselor = (c) => {
      setSelectedCounselor(c)
      setLoadingResponses(true)
      axios.get(`/api/counselors/${c._id}/responses`)
        .then(res => {
          setCounselorResponses(res.data)
          setLoadingResponses(false)
        })
        .catch(() => setLoadingResponses(false))
    }

    const handleSelectStudent = (s) => {
      setSelectedStudent(s)
      setLoadingStudentData(true)
      Promise.all([
        axios.get(`/api/students/${s._id}/journal`),
        axios.get(`/api/suggestions/${s._id}`)
      ]).then(([jRes, sRes]) => {
        setStudentJournal(jRes.data)
        setStudentSuggestions(sRes.data)
        setLoadingStudentData(false)
      }).catch(() => setLoadingStudentData(false))
    }

    const handleViewAlert = (a) => {
      setSelectedAlert(a)
      setAlertNotes('')
    }

    const fetchAssessmentHistory = (studentId) => {
      if (!studentId) {
        setAssessmentHistory([])
        return
      }
      setLoadingAssessments(true)
      axios.get(`/api/students/${studentId}/journal`)
        .then(res => {
          setAssessmentHistory(res.data)
          setLoadingAssessments(false)
        })
        .catch(() => setLoadingAssessments(false))
    }

    const calculateAssessmentScore = (entry) => {
      const sScore = Math.max(0, Math.min(10, (entry.sentiment || 0) + 5))
      const mScore = (5 - (entry.mood || 3)) * 2.5
      const aScore = Math.max(0, Math.min(10, 10 - (entry.anxiety || 0)))
      return (sScore * 0.4 + mScore * 0.3 + aScore * 0.3).toFixed(1)
    }

    const getMoodLabel = (mood) => {
      if (mood <= 2) return { label: 'Poor', color: 'bg-red-500' }
      if (mood === 3) return { label: 'Fair', color: 'bg-amber-500' }
      return { label: 'Good', color: 'bg-green-500' }
    }

    const getAnxietyLabel = (anxiety) => {
      if (anxiety >= 7) return { label: 'Severe', color: 'text-red-600 bg-red-50 border-red-100' }
      if (anxiety >= 4) return { label: 'Moderate', color: 'text-amber-600 bg-amber-50 border-amber-100' }
      return { label: 'Mild', color: 'text-green-600 bg-green-50 border-green-100' }
    }

    const getSleepLabel = (sleep) => {
      if (sleep <= 2) return { label: 'Poor', color: 'text-red-600 bg-red-50 border-red-100' }
      if (sleep === 3) return { label: 'Fair', color: 'text-amber-600 bg-amber-50 border-amber-100' }
      return { label: 'Good', color: 'text-green-600 bg-green-50 border-green-100' }
    }

    const exportToCSV = (data, filename) => {
      if (!data || data.length === 0) return;
      const headers = Object.keys(data[0]).join(',');
      const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(','));
      const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows.join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `${filename}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }

  const menuItems = [
    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'User Management', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { name: 'Student Data', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { name: 'Assessments', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { name: 'Counselors', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
    { name: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  ]

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-900">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">MH Monitor</h1>
            <p className="text-[10px] text-indigo-300 uppercase tracking-widest">Mental Health System</p>
          </div>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                activeMenu === item.name 
                ? 'bg-white text-indigo-900 shadow-lg' 
                : 'hover:bg-indigo-800 text-indigo-100'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              {item.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Student Mental Health Monitoring System</h2>
            <p className="text-sm text-slate-500">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase">Admin</span>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full border">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs text-left">
                <p className="font-bold text-slate-700">{user?.name}</p>
                <p className="text-slate-400 font-medium">admin</p>
              </div>
            </div>
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeMenu === 'User Management' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">User Management</h3>
                  <p className="text-slate-500">Manage system users and access control</p>
                </div>
                <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:bg-slate-800 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Add User
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b bg-slate-50/50">
                  <div className="relative max-w-md">
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-4">ID</th>
                        <th className="px-6 py-4">Username</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Role</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredUsers.map((u, i) => (
                        <tr key={u._id || i} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 text-slate-400 font-medium">{i + 1}</td>
                          <td className="px-6 py-4 font-bold text-slate-700">{u.name}</td>
                          <td className="px-6 py-4 text-slate-500">{u.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                              u.role === 'admin' ? 'bg-red-100 text-red-600' :
                              u.role === 'counselor' ? 'bg-green-100 text-green-600' :
                              'bg-blue-100 text-blue-600'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="flex items-center gap-1.5 text-green-600 font-bold border border-green-200 bg-green-50 px-2 py-0.5 rounded-lg text-xs w-fit">
                              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                              Active
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button 
                                onClick={() => deleteUser(u._id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'Dashboard' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Dashboard Overview</h3>
                <p className="text-slate-500 text-sm font-medium">Real-time insights and mental health statistics</p>
              </div>

              {/* Four Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Total Students</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{dashboardStats?.totalStudents || 0}</h4>
                    <p className="text-green-500 text-[11px] mt-1 font-bold">Registered Students</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">High Risk Alerts</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{alertStats.highRisk}</h4>
                    <p className="text-red-500 text-[11px] mt-1 font-bold">Critical & High</p>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Feedback Given</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{dashboardStats?.reportsGenerated || 0}</h4>
                    <p className="text-green-500 text-[11px] mt-1 font-bold">Counselor Suggestions</p>
                  </div>
                  <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-green-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Avg Health Score</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{dashboardStats?.avgScore || '0.0'}</h4>
                    <p className="text-indigo-500 text-[11px] mt-1 font-bold">System Wellbeing</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Middle Section: Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Mental Health Trend */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border">
                  <h4 className="font-bold text-slate-800 mb-8">Mental Health Trend (Last 6 Months)</h4>
                  <div className="h-64 flex items-end justify-between gap-2 px-6 border-b border-l relative">
                    {/* Dynamic Line Chart */}
                    <svg className="absolute inset-0 w-full h-full overflow-visible px-6" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path 
                        d={dashboardStats?.trend ? 
                          `M ${dashboardStats.trend.map((t, i) => `${i * 20} ${100 - (t.score * 10)}`).join(' L ')}` : 
                          "M 0 35 L 20 32 L 40 38 L 60 30 L 80 27 L 100 25"
                        } 
                        fill="none" 
                        stroke="#6366f1" 
                        strokeWidth="2"
                        className="drop-shadow-sm"
                      />
                      {(dashboardStats?.trend || [0, 20, 40, 60, 80, 100]).map((t, i) => (
                        <circle 
                          key={i} 
                          cx={i * 20} 
                          cy={dashboardStats?.trend ? 100 - (t.score * 10) : [35, 32, 38, 30, 27, 25][i]} 
                          r="2" 
                          fill="white" 
                          stroke="#6366f1" 
                          strokeWidth="1" 
                        />
                      ))}
                    </svg>
                    {(dashboardStats?.trend || [0, 1, 2, 3, 4, 5]).map((t, i) => (
                      <span key={i} className="text-[10px] text-slate-400 mt-2 font-bold uppercase tracking-widest">
                        {dashboardStats?.trend ? t.month : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'][i]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Mood Distribution */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border">
                  <h4 className="font-bold text-slate-800 mb-8">Current Mood Distribution</h4>
                  <div className="flex items-center justify-around h-64 relative">
                    <div className="relative w-48 h-48 rounded-full border-[20px] border-slate-100 flex items-center justify-center">
                      <div className="absolute inset-[-20px] rounded-full border-[20px] border-t-green-500 border-r-blue-500 border-b-amber-500 border-l-red-500 opacity-80"></div>
                      <div className="text-center">
                        <p className="text-2xl font-black text-slate-800">100%</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {Object.entries(dashboardStats?.moodDist || { Excellent: 30, Good: 45, Fair: 20, Poor: 5 }).map(([mood, pct]) => (
                        <div key={mood} className="flex items-center gap-3">
                          <span className={`text-[11px] font-bold uppercase tracking-wider ${
                            mood === 'Excellent' ? 'text-green-500' :
                            mood === 'Good' ? 'text-blue-500' :
                            mood === 'Fair' ? 'text-amber-500' :
                            'text-red-500'
                          }`}>
                            {mood}: {pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Risk Levels */}
                <div className="bg-[#2c333f] p-8 rounded-[2rem] shadow-2xl font-sans h-[450px]">
                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-black text-white tracking-tight">Students by Risk Level</h4>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart 
                        data={Object.entries(dashboardStats?.riskLevels || { Low: 0, Medium: 0, High: 0, Critical: 0 }).map(([risk, count]) => ({ risk, count }))}
                        margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
                      >
                        <XAxis 
                          dataKey="risk" 
                          axisLine={{ stroke: '#fff', strokeWidth: 1 }} 
                          tickLine={false} 
                          tick={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}
                          dy={15}
                        />
                        <YAxis 
                          axisLine={{ stroke: '#fff', strokeWidth: 1 }} 
                          tickLine={false} 
                          tick={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                        />
                        <Bar dataKey="count" radius={[5, 5, 0, 0]} barSize={50}>
                          {Object.entries(dashboardStats?.riskLevels || {}).map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry[0] === 'Critical' ? '#e03131' : entry[0] === 'High' ? '#f08c00' : entry[0] === 'Medium' ? '#be4bdb' : '#40c057'} 
                            />
                          ))}
                          <LabelList dataKey="count" position="top" style={{ fill: '#fff', fontSize: 14, fontWeight: 900 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white p-8 rounded-2xl shadow-sm border">
                  <h4 className="font-bold text-slate-800 mb-8">Recent Activity</h4>
                  <div className="space-y-6">
                    {(dashboardStats?.recentActivity || []).map((activity, i) => (
                      <div key={i} className="flex gap-4 relative">
                        {i < (dashboardStats?.recentActivity?.length - 1) && <div className="absolute left-[5px] top-4 bottom-[-24px] w-[1px] bg-slate-100"></div>}
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm ${
                          activity.type === 'Alert' ? 'bg-red-500 shadow-red-200' :
                          activity.type === 'Feedback' ? 'bg-green-500 shadow-green-200' :
                          'bg-indigo-600 shadow-indigo-200'
                        }`}></div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800">{activity.text}</p>
                          <p className="text-xs text-slate-400 font-medium">
                            {new Date(activity.time).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'Student Data' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Student Data Management</h3>
                  <p className="text-slate-500 text-sm">View and manage student mental health records</p>
                </div>
                <button 
                  onClick={() => exportToCSV(students.map(s => ({ Name: s.name, Email: s.email, Risk: s.latestRisk, Score: s.latestScore, Counselor: s.latestSuggestion?.counselor?.name || 'Unassigned' })), 'student_data_export')}
                  className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-lg font-bold shadow-lg hover:bg-slate-800 transition"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Data
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b bg-slate-50/50">
                  <div className="relative max-w-xl">
                    <input
                      type="text"
                      placeholder="Search students..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Assigned Counselor</th>
                        <th className="px-6 py-4 text-center">Risk Level</th>
                        <th className="px-6 py-4 text-center">Health Score</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredStudents.map((s) => (
                        <tr key={s._id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 font-bold text-slate-700">{s.name}</td>
                          <td className="px-6 py-4 text-slate-500">{s.email}</td>
                          <td className="px-6 py-4">
                            {s.latestSuggestion ? (
                              <span className="text-indigo-600 font-medium">{s.latestSuggestion.counselor?.name}</span>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              s.latestRisk === 'critical' ? 'bg-red-500 text-white' :
                              s.latestRisk === 'high' ? 'bg-red-500 text-white' :
                              s.latestRisk === 'medium' ? 'bg-amber-500 text-white' :
                              'bg-green-500 text-white'
                            }`}>
                              {s.latestRisk === 'medium' ? 'Moderate' : s.latestRisk}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center font-black text-slate-800">{s.latestScore}/10</td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleSelectStudent(s)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'Assessments' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Historical Assessments</h3>
                <p className="text-slate-500 text-sm">Review complete history of student self-assessments</p>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border space-y-4">
                <h4 className="font-bold text-slate-800">Select Student</h4>
                <select 
                  className="w-full max-w-md bg-slate-50 border rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-500 transition text-slate-700 font-medium"
                  value={selectedAssessmentStudentId}
                  onChange={(e) => {
                    setSelectedAssessmentStudentId(e.target.value);
                    fetchAssessmentHistory(e.target.value);
                  }}
                >
                  <option value="">Choose a student...</option>
                  {students.map(s => (
                    <option key={s._id} value={s._id}>{s.name} ({s.email})</option>
                  ))}
                </select>
              </div>

              {selectedAssessmentStudentId && (
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase tracking-wider font-bold">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Mood</th>
                          <th className="px-6 py-4">Anxiety</th>
                          <th className="px-6 py-4 text-center">Score</th>
                          <th className="px-6 py-4">Journal Entry</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y text-sm">
                        {assessmentHistory.map((entry) => (
                          <tr key={entry._id} className="hover:bg-slate-50/50 transition">
                            <td className="px-6 py-4 font-bold text-slate-700">
                              {new Date(entry.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4">
                              <span className={`${getMoodLabel(entry.mood).color} text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase`}>
                                {getMoodLabel(entry.mood).label}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`${getAnxietyLabel(entry.anxiety).color} text-[10px] font-bold px-2 py-1 rounded-lg border uppercase`}>
                                {getAnxietyLabel(entry.anxiety).label}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center font-black text-indigo-600">
                              {calculateAssessmentScore(entry)}/10
                            </td>
                            <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">
                              "{entry.text}"
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeMenu === 'Counselors' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Counselor Management</h3>
                  <p className="text-slate-500 text-sm">Monitor counselor performance and student interactions</p>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="p-6 border-b bg-slate-50/50">
                  <div className="relative max-w-xl">
                    <input
                      type="text"
                      placeholder="Search counselors..."
                      value={counselorSearch}
                      onChange={(e) => setCounselorSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4 text-center">Interventions</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {filteredCounselors.map((c) => (
                        <tr key={c._id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 font-bold text-slate-700">{c.name}</td>
                          <td className="px-6 py-4 text-slate-500">{c.email}</td>
                          <td className="px-6 py-4 text-center font-bold text-indigo-600">{c.responseCount}</td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleSelectCounselor(c)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'Alerts' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-800">Alerts & Notifications</h3>
                <p className="text-slate-500 text-sm">Monitor and respond to critical mental health alerts</p>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Active Alerts</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{alertStats.active}</h4>
                  </div>
                  <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Critical Level</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{alertStats.critical}</h4>
                  </div>
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border flex items-center justify-between">
                  <div>
                    <p className="text-slate-400 text-sm font-medium">Resolved Today</p>
                    <h4 className="text-3xl font-bold text-slate-800 mt-1">{alertStats.resolvedToday}</h4>
                  </div>
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center text-green-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Alerts Table */}
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-slate-500 text-xs uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-4">Student</th>
                        <th className="px-6 py-4">Context</th>
                        <th className="px-6 py-4">Risk</th>
                        <th className="px-6 py-4 text-center">Time</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-sm">
                      {alerts.filter(a => a.status !== 'Resolved').map((a) => (
                        <tr key={a._id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-4 font-bold text-slate-700">{a.user?.name}</td>
                          <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">"{a.message}"</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              a.risk === 'critical' ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'
                            }`}>{a.risk}</span>
                          </td>
                          <td className="px-6 py-4 text-center text-slate-400 font-medium">
                            {new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.status === 'Active' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                            }`}>{a.status}</span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button onClick={() => handleViewAlert(a)} className="p-1.5 text-slate-400 hover:text-indigo-600">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modals */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedStudent.name}</h2>
                  <p className="text-sm text-slate-500">{selectedStudent.email}</p>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-slate-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1 grid grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Journal History</h3>
                  <div className="space-y-4">
                    {studentJournal.map(entry => (
                      <div key={entry._id} className="p-4 rounded-2xl border bg-slate-50">
                        <p className="text-sm text-slate-700 italic">"{entry.text}"</p>
                        <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">{new Date(entry.createdAt).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Previous Feedback</h3>
                  <div className="space-y-4">
                    {studentSuggestions.map(s => (
                      <div key={s._id} className="p-4 rounded-2xl border-2 border-indigo-50 bg-white">
                        <p className="text-sm text-slate-700 font-medium">"{s.text}"</p>
                        <p className="text-[10px] text-indigo-400 mt-2 font-bold uppercase tracking-widest">Sent by {s.counselor?.name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedCounselor && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between bg-indigo-50">
                <h2 className="text-xl font-bold text-indigo-900">Counselor Activity: {selectedCounselor.name}</h2>
                <button onClick={() => setSelectedCounselor(null)} className="text-indigo-400 hover:text-indigo-600">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1">
                <h3 className="text-xs font-bold text-slate-400 uppercase mb-4">Intervention History</h3>
                <div className="space-y-4">
                  {counselorResponses.map(r => (
                    <div key={r._id} className="p-4 rounded-2xl border bg-white">
                      <p className="text-sm font-bold text-slate-800">To Student: {r.student?.name}</p>
                      <p className="text-sm text-slate-600 mt-1 italic">"{r.text}"</p>
                      <p className="text-[10px] text-slate-400 mt-2">{new Date(r.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {selectedAlert && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl shadow-xl w-full max-w-lg overflow-hidden">
              <div className="p-6 border-b bg-red-50 flex justify-between items-center">
                <h2 className="text-xl font-bold text-red-900 uppercase">Triage Alert</h2>
                <button onClick={() => setSelectedAlert(null)} className="text-red-400 hover:text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-8 space-y-6">
                <div className="bg-slate-50 p-4 rounded-2xl border italic text-slate-700 leading-relaxed">"{selectedAlert.message}"</div>
                <div className="flex gap-4">
                  <button 
                    onClick={() => { updateAlertStatus(selectedAlert._id, 'Acknowledged'); setSelectedAlert(null); }}
                    className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-bold text-sm uppercase"
                  >Acknowledge</button>
                  <button 
                    onClick={() => { updateAlertStatus(selectedAlert._id, 'Resolved'); setSelectedAlert(null); }}
                    className="flex-1 bg-white border-2 border-slate-200 text-slate-700 py-4 rounded-2xl font-bold text-sm uppercase"
                  >Mark Resolved</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
