import { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts'

export default function CounselorDashboard() {
  const { user, logout } = useAuth()
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [alerts, setAlerts] = useState([])
  const [students, setStudents] = useState([])
  const [studentSearch, setStudentSearch] = useState('')
  
  // Selection states for details
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentJournal, setStudentJournal] = useState([])
  const [studentSuggestions, setStudentSuggestions] = useState([])
  const [newSuggestion, setNewSuggestion] = useState('')
  const [loadingStudentData, setLoadingStudentData] = useState(false)
  
  const [selectedAlert, setSelectedAlert] = useState(null)
  const [alertNotes, setAlertNotes] = useState('')
  
  const [selectedAssessmentStudentId, setSelectedAssessmentStudentId] = useState('')
  const [assessmentHistory, setAssessmentHistory] = useState([])
  const [loadingAssessments, setLoadingAssessments] = useState(false)
  
  
  const [dashboardStats, setDashboardStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    fetchDashboardStats()
    
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4002')
    socket.emit('joinRole', 'counselor')
    socket.on('alert', a => setAlerts(prev => [a, ...prev]))
    return () => socket.disconnect()
  }, [])

  const fetchDashboardData = () => {
    axios.get('/api/alerts').then(r => setAlerts(r.data))
    axios.get('/api/students').then(r => setStudents(r.data))
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

  const handleSendSuggestion = (e) => {
    e.preventDefault()
    if (!newSuggestion.trim() || !selectedStudent) return
    axios.post('/api/suggestions', { studentId: selectedStudent._id, text: newSuggestion })
      .then(res => {
        setStudentSuggestions([res.data, ...studentSuggestions])
        setNewSuggestion('')
        fetchDashboardData() // Refresh student stats
      })
  }

  const alertStats = {
    active: alerts.filter(a => a.status !== 'Resolved').length,
    highRisk: alerts.filter(a => (a.risk === 'critical' || a.risk === 'high') && a.status !== 'Resolved').length,
    resolvedToday: alerts.filter(a => a.status === 'Resolved' && new Date(a.updatedAt).toDateString() === new Date().toDateString()).length
  }

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.email.toLowerCase().includes(studentSearch.toLowerCase())
  )

  const handleSelectStudent = (s) => {
    setSelectedStudent(s)
    setLoadingStudentData(true)
    // Fetch journal entries and suggestions
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
    { name: 'Student Data', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z' },
    { name: 'Assessments', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { name: 'Alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
  ]

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-indigo-900 shadow-xl shadow-indigo-950/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight">MH Monitor</h1>
            <p className="text-[10px] text-indigo-300 uppercase tracking-widest font-black">Counselor Portal</p>
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
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between shadow-sm z-10">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Counselor Dashboard</h2>
            <p className="text-sm text-slate-500">Welcome back, {user?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-1 rounded uppercase tracking-tighter shadow-sm shadow-green-200">Counselor</span>
            <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-50 rounded-full border">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="text-xs text-left">
                <p className="font-bold text-slate-700 leading-none mb-0.5">{user?.name}</p>
                <p className="text-slate-400 font-medium leading-none uppercase text-[8px] tracking-widest">Active Session</p>
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
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeMenu === 'Dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Dashboard Overview</h3>
                  <p className="text-slate-500 text-sm font-medium">Real-time student insights and mental health monitoring</p>
                </div>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div>
                    <p className="text-[#5e1675] text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Total Students</p>
                    <h4 className="text-4xl font-black text-[#2d5a6e] tracking-tight">{dashboardStats?.totalStudents || 0}</h4>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                      <p className="text-green-600 text-[10px] font-black uppercase tracking-widest">Active Database</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div>
                    <p className="text-[#5e1675] text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">High Risk Alerts</p>
                    <h4 className="text-4xl font-black text-[#ef4444] tracking-tight">{alertStats.highRisk}</h4>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-bounce"></span>
                      <p className="text-red-600 text-[10px] font-black uppercase tracking-widest">Action Required</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-red-600 shadow-inner group-hover:bg-red-500 group-hover:text-white transition-all duration-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div>
                    <p className="text-[#5e1675] text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Feedback Given</p>
                    <h4 className="text-4xl font-black text-[#2d5a6e] tracking-tight">{dashboardStats?.reportsGenerated || 0}</h4>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                      <p className="text-blue-600 text-[10px] font-black uppercase tracking-widest">Interventions</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-green-100 group-hover:bg-green-500 transition-all duration-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
                  <div>
                    <p className="text-[#5e1675] text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">Avg Score</p>
                    <h4 className="text-4xl font-black text-[#2d5a6e] tracking-tight">{dashboardStats?.avgScore || '0.0'}</h4>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      <p className="text-amber-600 text-[10px] font-black uppercase tracking-widest">Overall Wellbeing</p>
                    </div>
                  </div>
                  <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-100 group-hover:bg-amber-500 transition-all duration-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Mental Health Trend */}
                <div className="bg-[#2c333f] p-8 rounded-[2rem] shadow-2xl font-sans h-[450px]">
                  <div className="text-center mb-6">
                    <h4 className="text-2xl font-black text-white tracking-tight">System Health Trend</h4>
                  </div>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardStats?.trend || []} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
                        <XAxis 
                          dataKey="month" 
                          axisLine={{ stroke: '#fff', strokeWidth: 1 }} 
                          tickLine={false} 
                          tick={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}
                          dy={15}
                        />
                        <YAxis 
                          domain={[0, 10]} 
                          axisLine={{ stroke: '#fff', strokeWidth: 1 }} 
                          tickLine={false} 
                          tick={{ fill: '#fff', fontSize: 12, fontWeight: 700 }}
                        />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.1)' }}
                          contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '12px', color: '#fff' }}
                        />
                        <Bar dataKey="score" fill="#4f46e5" radius={[5, 5, 0, 0]} barSize={40}>
                          {(dashboardStats?.trend || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#4c6ef5', '#40c057', '#e03131', '#be4bdb', '#f08c00', '#0ca678', '#adb5bd'][index % 7]} />
                          ))}
                          <LabelList dataKey="score" position="top" style={{ fill: '#fff', fontSize: 14, fontWeight: 900 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Mood Distribution */}
                <div className="bg-[#2c333f] p-8 rounded-[2rem] shadow-2xl font-sans h-[450px]">
                  <div className="text-center mb-8">
                    <h4 className="text-2xl font-black text-white tracking-tight">Mood Analysis</h4>
                  </div>
                  <div className="flex flex-col items-center justify-center h-[300px] relative">
                    <div className="relative w-56 h-56 rounded-full border-[24px] border-slate-700 flex items-center justify-center shadow-inner group">
                      <div className="absolute inset-[-24px] rounded-full border-[24px] border-t-green-500 border-r-blue-500 border-b-amber-500 border-l-red-500 opacity-80 group-hover:opacity-100 transition-opacity duration-500"></div>
                      <div className="text-center">
                        <p className="text-4xl font-black text-white">100%</p>
                        <p className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.2em] mt-1">Monitored</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-10">
                      {Object.entries(dashboardStats?.moodDist || { Excellent: 30, Good: 45, Fair: 20, Poor: 5 }).map(([mood, pct]) => (
                        <div key={mood} className="flex items-center gap-3 group">
                          <span className={`w-3.5 h-3.5 rounded-sm shadow-sm group-hover:scale-125 transition-transform duration-300 ${
                            mood === 'Excellent' ? 'bg-green-500' :
                            mood === 'Good' ? 'bg-blue-500' :
                            mood === 'Fair' ? 'bg-amber-500' :
                            'bg-red-500'
                          }`}></span>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest opacity-60">{mood}</span>
                            <span className="text-sm font-black text-white">{pct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Section: Risk Levels and Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Risk Levels Chart */}
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
                  <h4 className="font-bold text-slate-800 mb-8 flex items-center justify-between">
                    Latest Activity
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Live Log</span>
                  </h4>
                  <div className="space-y-6 max-h-64 overflow-y-auto pr-4 custom-scrollbar">
                    {(dashboardStats?.recentActivity || []).map((activity, i) => (
                      <div key={i} className="flex gap-4 relative group">
                        {i < (dashboardStats?.recentActivity?.length - 1) && <div className="absolute left-[5px] top-4 bottom-[-24px] w-[1px] bg-slate-100 group-hover:bg-indigo-100 transition-colors"></div>}
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 shadow-sm transition-transform group-hover:scale-125 ${
                          activity.type === 'Alert' ? 'bg-red-500 shadow-red-200' :
                          activity.type === 'Feedback' ? 'bg-green-500 shadow-green-200' :
                          'bg-indigo-600 shadow-indigo-200'
                        }`}></div>
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{activity.text}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-tight">
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
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-slate-800">Student Profiles</h3>
                  <p className="text-slate-500 text-sm font-medium">Complete mental health records and counselor intervention tracking</p>
                </div>
                <button 
                  onClick={() => exportToCSV(students.map(s => ({ Name: s.name, Email: s.email, Risk: s.latestRisk, Score: s.latestScore })), 'counselor_student_export')}
                  className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all hover:-translate-y-0.5"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export Data
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b bg-slate-50/30">
                  <div className="relative max-w-xl">
                    <input
                      type="text"
                      placeholder="Search students by name or email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border-2 border-slate-100 rounded-2xl outline-none focus:border-indigo-500 transition-all text-sm font-medium"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3.5 top-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-slate-400 text-[10px] uppercase tracking-[0.15em] font-black">
                      <tr>
                        <th className="px-6 py-5">Student Information</th>
                        <th className="px-6 py-5 text-center">Status</th>
                        <th className="px-6 py-5 text-center">Wellness</th>
                        <th className="px-6 py-5">Last Submission</th>
                        <th className="px-6 py-5 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 text-sm">
                      {filteredStudents.map((s) => (
                        <tr key={s._id} className="hover:bg-indigo-50/30 transition-all group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 bg-white border-2 border-slate-100 rounded-xl flex items-center justify-center text-indigo-600 font-black text-xs group-hover:border-indigo-200 transition-colors shadow-sm">
                                {s.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-700 group-hover:text-indigo-900 transition-colors">{s.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{s.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              s.latestRisk === 'critical' ? 'bg-red-500 text-white shadow-md shadow-red-100' :
                              s.latestRisk === 'high' ? 'bg-red-100 text-red-600' :
                              s.latestRisk === 'medium' ? 'bg-amber-100 text-amber-600' :
                              'bg-green-100 text-green-600'
                            }`}>
                              {s.latestRisk === 'medium' ? 'Moderate' : s.latestRisk}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="font-black text-slate-800 text-lg leading-none">{s.latestScore}</span>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                                <div className={`h-full rounded-full transition-all duration-1000 ${parseFloat(s.latestScore) > 7 ? 'bg-green-500' : parseFloat(s.latestScore) > 4 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${parseFloat(s.latestScore)*10}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-slate-500 font-bold text-xs uppercase tracking-tight">
                              {s.lastAssessmentDate ? new Date(s.lastAssessmentDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No Data'}
                            </p>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button 
                              onClick={() => handleSelectStudent(s)}
                              className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-sm border border-transparent hover:border-indigo-100"
                              title="Review & Respond"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

        {/* Student Details Modal with Suggestion Form */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-500 border border-white/20">
              <div className="p-10 border-b bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center text-white text-2xl font-black shadow-xl shadow-indigo-100">
                    {selectedStudent.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 leading-tight tracking-tight">{selectedStudent.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-sm text-slate-500 font-bold tracking-tight">{selectedStudent.email}</p>
                      <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${
                        selectedStudent.latestRisk === 'critical' ? 'text-red-600' : 
                        selectedStudent.latestRisk === 'high' ? 'text-orange-600' : 'text-green-600'
                      }`}>Status: {selectedStudent.latestRisk}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedStudent(null)} className="p-3 bg-white hover:bg-red-50 rounded-2xl transition-all text-slate-400 hover:text-red-600 shadow-sm border border-slate-100 hover:border-red-100">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-10 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-10 custom-scrollbar">
                {/* Left Column: Context & History */}
                <div className="lg:col-span-8 space-y-10">
                  {/* Recent Assessment Insight - Verbatim show only latest as requested */}
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                        <span className="w-8 h-[2px] bg-indigo-100"></span>
                        Recent Assessment Snapshot
                    </h3>
                    {studentJournal.length > 0 ? (
                        <div className="bg-indigo-900 text-white rounded-[2.5rem] p-10 shadow-2xl shadow-indigo-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-10 opacity-10">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div className="relative z-10 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-300">Journal Narrative</p>
                                        <p className="text-xs font-bold text-indigo-200 opacity-60 uppercase">{new Date(studentJournal[0].createdAt).toLocaleString(undefined, { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <span className={`px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg ${
                                        studentJournal[0].risk === 'critical' ? 'bg-red-500 text-white' : 
                                        studentJournal[0].risk === 'high' ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'
                                    }`}>{studentJournal[0].risk} Risk</span>
                                </div>
                                <p className="text-xl font-medium leading-relaxed italic text-indigo-50">
                                    <span className="text-4xl text-indigo-400/40 font-serif leading-none mr-2">"</span>
                                    {studentJournal[0].text}
                                    <span className="text-4xl text-indigo-400/40 font-serif leading-none ml-2">"</span>
                                </p>
                                <div className="grid grid-cols-3 gap-6 pt-6 border-t border-white/10">
                                    <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-md">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Mood</p>
                                        <p className="text-lg font-black mt-1">{getMoodLabel(studentJournal[0].mood).label}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-md">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Anxiety</p>
                                        <p className="text-lg font-black mt-1">{getAnxietyLabel(studentJournal[0].anxiety).label}</p>
                                    </div>
                                    <div className="bg-white/5 p-4 rounded-2xl backdrop-blur-md">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Sentiment</p>
                                        <p className="text-lg font-black mt-1">{(studentJournal[0].sentiment || 0) > 0 ? '+' : ''}{studentJournal[0].sentiment}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-slate-50 rounded-[2.5rem] py-16 text-center text-slate-400 italic border-4 border-dashed border-slate-100 font-bold uppercase tracking-widest text-xs">No recent assessments found.</div>
                    )}
                  </div>

                  {/* History List */}
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-2">
                        <span className="w-8 h-[2px] bg-slate-100"></span>
                        Behavioral History
                    </h3>
                    <div className="space-y-6">
                      {studentJournal.length > 1 ? studentJournal.slice(1, 4).map(entry => (
                        <div key={entry._id} className="border-2 border-slate-50 rounded-3xl p-8 bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all relative overflow-hidden group">
                          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                            entry.risk === 'critical' ? 'bg-red-500' :
                            entry.risk === 'high' ? 'bg-orange-500' :
                            entry.risk === 'medium' ? 'bg-amber-500' :
                            'bg-green-500'
                          }`}></div>
                          <div className="flex justify-between items-center mb-4">
                            <span className={`text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-[0.15em] ${
                              entry.risk === 'critical' ? 'bg-red-50 text-red-600' : 
                              entry.risk === 'high' ? 'bg-orange-50 text-orange-600' :
                              'bg-green-50 text-green-600'
                            }`}>{entry.risk} Risk</span>
                            <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(entry.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed font-medium group-hover:text-slate-900 transition-colors">
                            "{entry.text}"
                          </p>
                        </div>
                      )) : studentJournal.length === 1 ? (
                        <div className="py-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px] border-2 border-dashed border-slate-100 rounded-[2rem]">Initial entry only. No further history.</div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Right Column: Feedback & Interaction */}
                <div className="lg:col-span-4 space-y-8 bg-slate-50/50 p-8 rounded-[3rem] border-2 border-slate-50 shadow-inner h-fit">
                  {/* Suggestion only for critical, high and moderate as requested */}
                  {(selectedStudent.latestRisk === 'critical' || selectedStudent.latestRisk === 'high' || selectedStudent.latestRisk === 'medium') ? (
                    <div>
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                            <span className="w-6 h-[2px] bg-indigo-200"></span>
                            Active Intervention
                        </h3>
                        <form onSubmit={handleSendSuggestion} className="space-y-6">
                        <div className="relative">
                            <textarea 
                                value={newSuggestion}
                                onChange={e => setNewSuggestion(e.target.value)}
                                className="w-full border-2 border-white rounded-[2rem] p-8 h-56 outline-none focus:border-indigo-600 text-sm font-medium shadow-xl shadow-indigo-100/20 transition-all resize-none leading-relaxed"
                                placeholder="Type your professional feedback or support recommendations here..."
                            />
                            <div className="absolute bottom-6 right-8 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                {newSuggestion.length} chars
                            </div>
                        </div>
                        <button className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.25em] hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 group active:scale-[0.98]">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                            Dispatch Feedback
                        </button>
                        </form>
                    </div>
                  ) : (
                    <div className="py-10 text-center space-y-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto shadow-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-relaxed">
                            Intervention is currently restricted to students in <span className="text-red-500">Critical</span>, <span className="text-orange-500">High</span>, or <span className="text-amber-500">Moderate</span> risk categories.
                        </p>
                    </div>
                  )}

                  {/* Suggestion History */}
                  <div className="pt-8 border-t border-slate-200/60">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Interaction Log</h3>
                    <div className="space-y-6 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {studentSuggestions.length > 0 ? studentSuggestions.map(s => (
                        <div key={s._id} className="bg-white p-6 rounded-2xl border-2 border-white shadow-sm hover:shadow-md transition-shadow">
                          <p className="text-xs font-black text-indigo-600 uppercase tracking-widest mb-2 flex items-center justify-between">
                            {s.counselor?.name || 'Me'}
                            <span className="text-[9px] text-slate-300 font-bold">{new Date(s.createdAt).toLocaleDateString()}</span>
                          </p>
                          <p className="text-xs text-slate-600 font-medium leading-relaxed italic">"{s.text}"</p>
                        </div>
                      )) : (
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest text-center py-4">No previous interactions logged.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Alert View Modal with Triage */}
        {selectedAlert && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl flex items-center justify-center p-4 z-50 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
              <div className="p-10 border-b bg-red-50/50 flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-red-600 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shadow-red-200 animate-pulse">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-black text-slate-800 leading-tight uppercase tracking-tight">Priority Triage</h2>
                    <p className="text-sm text-red-600 font-black uppercase tracking-widest mt-1">Escalated: {selectedAlert.user?.name}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedAlert(null)} className="p-3 bg-white hover:bg-slate-50 rounded-2xl transition-all text-slate-400 border border-slate-100 shadow-sm">
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="p-10 space-y-8">
                <div className="bg-slate-50 p-8 rounded-[2rem] border-2 border-slate-100 shadow-inner">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-red-200"></span>
                    Detected Sentiment Context
                  </p>
                  <p className="text-lg font-medium text-slate-800 italic leading-relaxed">
                    <span className="text-3xl text-red-200 font-serif leading-none mr-1">"</span>
                    {selectedAlert.message}
                    <span className="text-3xl text-red-200 font-serif leading-none ml-1">"</span>
                  </p>
                </div>

                <div className="space-y-4">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="w-6 h-[2px] bg-indigo-200"></span>
                    Triage Decision
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => { updateAlertStatus(selectedAlert._id, 'Acknowledged'); setSelectedAlert(null); }}
                      className="bg-amber-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-xl shadow-amber-100 active:scale-[0.98]"
                    >
                      Acknowledge Case
                    </button>
                    <button 
                      onClick={() => { updateAlertStatus(selectedAlert._id, 'Resolved'); setSelectedAlert(null); }}
                      className="bg-green-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-xl shadow-green-100 active:scale-[0.98]"
                    >
                      Resolve & Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
