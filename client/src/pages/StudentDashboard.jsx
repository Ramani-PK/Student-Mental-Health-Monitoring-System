import { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useAuth } from '../context/AuthContext'
import JournalChart from '../components/JournalChart'

export default function StudentDashboard() {
  const { user, logout } = useAuth()
  const [entries, setEntries] = useState([])
  const [activeMenu, setActiveMenu] = useState('Dashboard')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [automatedSuggestions, setAutomatedSuggestions] = useState([])
  const [counselorSuggestions, setCounselorSuggestions] = useState([])
  const [myAlerts, setMyAlerts] = useState([])
  
  // Assessment Form State
  const [formData, setFormData] = useState({
    mood: 3,
    anxiety: 0,
    sleepQuality: 2,
    socialInteraction: 3,
    stressLevel: 2,
    academicPressure: 2,
    sadness: 0,
    energyLevel: 3,
    physicalHealth: 3,
    appetite: 3,
    text: ''
  })

  useEffect(() => {
    axios.get('/api/journal').then(r => setEntries(r.data))
    axios.get(`/api/suggestions/${user.id}`).then(r => setCounselorSuggestions(r.data))
    axios.get('/api/my-alerts').then(r => setMyAlerts(r.data)).catch(() => {})
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:4002')
    socket.emit('joinRole', 'student')
    return () => socket.disconnect()
  }, [])

  const calculateAvgScore = () => {
    if (entries.length === 0) return '0.0'
    const total = entries.reduce((acc, entry) => {
      const sScore = Math.max(0, Math.min(10, (entry.sentiment || 0) + 5))
      const mScore = (5 - (entry.mood || 3)) * 2.5
      const aScore = Math.max(0, Math.min(10, 10 - (entry.anxiety || 0)))
      return acc + (sScore * 0.4 + mScore * 0.3 + aScore * 0.3)
    }, 0)
    return (total / entries.length).toFixed(1)
  }

  const getLatestScore = () => {
    if (entries.length === 0) return '0.0'
    const entry = entries[entries.length - 1]
    const sScore = Math.max(0, Math.min(10, (entry.sentiment || 0) + 5))
    const mScore = (5 - (entry.mood || 3)) * 2.5
    const aScore = Math.max(0, Math.min(10, 10 - (entry.anxiety || 0)))
    return (sScore * 0.4 + mScore * 0.3 + aScore * 0.3).toFixed(1)
  }

  const getMoodLabel = (val) => {
    const labels = {
      1: { label: 'Excellent', color: 'bg-green-500' },
      2: { label: 'Good', color: 'bg-blue-500' },
      3: { label: 'Fair', color: 'bg-amber-500' },
      4: { label: 'Poor', color: 'bg-red-500' },
      5: { label: 'Very Poor', color: 'bg-red-700' }
    }
    return labels[val] || { label: 'Neutral', color: 'bg-slate-400' }
  }

  const getAnxietyLabel = (val) => {
    if (val === 0) return { label: 'None', color: 'text-green-600 border-green-200 bg-green-50' }
    if (val <= 3) return { label: 'Mild', color: 'text-blue-600 border-blue-200 bg-blue-50' }
    if (val <= 7) return { label: 'Moderate', color: 'text-amber-600 border-amber-200 bg-amber-50' }
    return { label: 'Severe', color: 'text-red-600 border-red-200 bg-red-50' }
  }

  const getSleepLabel = (val) => {
    const labels = {
      1: { label: 'Excellent', color: 'text-green-600 border-green-200 bg-green-50' },
      2: { label: 'Good', color: 'text-blue-600 border-blue-200 bg-blue-50' },
      3: { label: 'Fair', color: 'text-amber-600 border-amber-200 bg-amber-50' },
      4: { label: 'Poor', color: 'text-red-600 border-red-200 bg-red-50' }
    }
    return labels[val] || { label: 'Unknown', color: 'text-slate-400 border-slate-200 bg-slate-50' }
  }

  const stageFeedback = (status, risk) => {
    const stages = {
      Active: {
        icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
        color: 'bg-red-500',
        bg: 'bg-red-50 border-red-100',
        textColor: 'text-red-700',
        label: 'Alert Active',
        message: 'Your mental health concern has been flagged by the system. A counselor will review your case and reach out to you shortly. Please stay calm — help is on the way.',
        tip: 'Try deep breathing or talk to a trusted friend while you wait.'
      },
      Acknowledged: {
        icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
        color: 'bg-amber-500',
        bg: 'bg-amber-50 border-amber-100',
        textColor: 'text-amber-700',
        label: 'Under Review',
        message: 'A counselor has acknowledged your alert and is actively working on your case. Expect to be contacted soon. You are not alone in this.',
        tip: 'Write down your thoughts — journaling can ease anxiety while you wait.'
      },
      Resolved: {
        icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
        color: 'bg-green-500',
        bg: 'bg-green-50 border-green-100',
        textColor: 'text-green-700',
        label: 'Resolved',
        message: 'Your case has been reviewed and resolved by the counselor. Keep applying the strategies discussed. Your wellbeing matters — keep submitting assessments regularly.',
        tip: 'Celebrate small wins! Consistent check-ins lead to better mental health.'
      }
    }
    return stages[status] || stages.Active
  }

  async function handleSubmitAssessment(e) {
    e.preventDefault()
    try {
      const r = await axios.post('/api/journal', formData)
      setEntries(prev => [...prev, r.data])
      setAutomatedSuggestions(r.data.suggestions || [])
      setIsModalOpen(false)
      setFormData({
        mood: 3,
        anxiety: 0,
        sleepQuality: 2,
        socialInteraction: 3,
        stressLevel: 2,
        academicPressure: 2,
        sadness: 0,
        energyLevel: 3,
        physicalHealth: 3,
        appetite: 3,
        text: ''
      })
    } catch (error) {
      console.error('Submission failed:', error)
    }
  }

  const menuItems = [
    { name: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
    { name: 'Assessments', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' },
    { name: 'Feedback', icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z' },
  ]

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 bg-indigo-900 text-white flex flex-col shadow-2xl">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tighter uppercase leading-none">MH Monitor</h1>
            <p className="text-[9px] text-indigo-300 font-bold uppercase tracking-widest mt-0.5">Mental Health System</p>
          </div>
        </div>

        <nav className="flex-1 px-3 mt-4">
          {menuItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveMenu(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all group ${
                activeMenu === item.name 
                ? 'bg-white text-indigo-900 shadow-lg' 
                : 'text-indigo-100 hover:bg-white/5'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${activeMenu === item.name ? 'text-indigo-600' : 'text-indigo-300 group-hover:text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
              </svg>
              <span className={`font-bold text-xs ${activeMenu === item.name ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>{item.name}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        <header className="h-16 bg-white border-b px-8 flex items-center justify-between shadow-sm relative z-10">
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">Student Mental Health Monitoring System</h2>
            <p className="text-xs text-slate-400">Welcome back, student</p>
          </div>
          <div className="flex items-center gap-4">
             <span className="bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest">Student</span>
             <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
               </svg>
             </div>
             <div className="text-xs text-slate-600">
               <p className="font-bold leading-none">{user?.name}</p>
               <p className="text-[10px] text-slate-400 mt-0.5">student</p>
             </div>
             <button onClick={logout} className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-red-500 transition-colors">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
               </svg>
               Logout
             </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          {activeMenu === 'Dashboard' && (
            <div className="space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Average Score</p>
                      <h4 className="text-3xl font-black text-slate-800 mt-1">{calculateAvgScore()}/10</h4>
                    </div>
                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Latest Score</p>
                      <h4 className="text-3xl font-black text-slate-800 mt-1">{getLatestScore()}/10</h4>
                    </div>
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Latest Mood</p>
                      <span className={`inline-block mt-1 px-3 py-1 rounded-lg text-white text-[9px] font-black uppercase tracking-widest ${getMoodLabel(entries[entries.length-1]?.mood).color}`}>
                        {getMoodLabel(entries[entries.length-1]?.mood).label}
                      </span>
                    </div>
                    <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
               </div>

               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-8">
                    <div className="bg-[#2c333f] p-8 rounded-3xl shadow-xl">
                      <h4 className="text-sm font-black text-white mb-6 uppercase tracking-tight">Emotional Well-being Trends</h4>
                      <div className="h-[300px]">
                        <JournalChart data={entries} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                     {/* AI Daily Insights */}
                     <div className="bg-indigo-900 p-8 rounded-3xl shadow-lg text-white">
                        <h4 className="text-xs font-black mb-6 uppercase tracking-widest text-indigo-300">Daily Insights</h4>
                        <div className="space-y-4">
                           {automatedSuggestions.length > 0 ? automatedSuggestions.map((s, i) => (
                             <div key={i} className="flex gap-3">
                                <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full mt-1.5 shrink-0"></div>
                                <p className="text-xs font-medium leading-relaxed text-indigo-50">{s}</p>
                             </div>
                           )) : (
                             <p className="text-xs font-medium text-indigo-200 italic">Submit an assessment to get insights.</p>
                           )}
                        </div>
                     </div>

                     {/* Counselor Feedback Preview */}
                     <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6">
                       <div className="flex items-center justify-between mb-4">
                         <h4 className="text-xs font-black uppercase tracking-widest text-slate-500">Counselor Feedback</h4>
                         {counselorSuggestions.length > 0 && (
                           <button
                             onClick={() => setActiveMenu('Feedback')}
                             className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:text-indigo-800 transition-colors"
                           >
                             View All →
                           </button>
                         )}
                       </div>
                       {counselorSuggestions.length > 0 ? (
                         <div className="space-y-3">
                           {counselorSuggestions.slice(0, 2).map((s) => (
                             <div key={s._id} className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100">
                               <div className="flex items-center justify-between mb-2">
                                 <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                                   {s.counselor?.name || 'Counselor'}
                                 </span>
                                 <span className="text-[9px] text-slate-400 font-bold">
                                   {new Date(s.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                 </span>
                               </div>
                               <p className="text-xs text-slate-700 font-medium leading-relaxed italic">"{s.text}"</p>
                             </div>
                           ))}
                         </div>
                       ) : (
                         <div className="text-center py-4">
                           <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                             </svg>
                           </div>
                           <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">No feedback yet</p>
                         </div>
                       )}
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeMenu === 'Assessments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Mental Health Assessments</h3>
                  <p className="text-xs text-slate-400">Submit and track your mental health assessments</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase tracking-widest flex items-center gap-2"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                     <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                   </svg>
                   New Assessment
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center justify-between mb-6">
                   <h4 className="text-sm font-bold text-slate-700">Your Assessment History</h4>
                   <span className="text-[10px] text-slate-400 font-bold bg-slate-50 px-2 py-1 rounded-md">{entries.length} Total Assessments</span>
                </div>

                <div className="bg-slate-50/50 rounded-2xl p-8 mb-8 flex items-center justify-around border">
                   <div className="text-center">
                      <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Average Score</p>
                      <p className="text-2xl font-black text-indigo-600 tracking-tight">{calculateAvgScore()}/10</p>
                   </div>
                   <div className="text-center">
                      <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Latest Score</p>
                      <p className="text-2xl font-black text-blue-600 tracking-tight">{getLatestScore()}/10</p>
                   </div>
                   <div className="text-center">
                      <p className="text-slate-400 text-[10px] font-bold uppercase mb-1">Latest Mood</p>
                      <span className={`inline-block px-3 py-1 rounded-lg text-white text-[9px] font-black uppercase tracking-widest ${getMoodLabel(entries[entries.length-1]?.mood).color}`}>
                        {getMoodLabel(entries[entries.length-1]?.mood).label}
                      </span>
                   </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="border-b text-slate-400 text-[10px] uppercase font-bold">
                      <tr>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Mood</th>
                        <th className="px-6 py-4">Anxiety Level</th>
                        <th className="px-6 py-4">Sleep Quality</th>
                        <th className="px-6 py-4 text-center">Score</th>
                        <th className="px-6 py-4">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                      {entries.slice().reverse().map((e) => (
                        <tr key={e._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-700 font-medium">
                            {new Date(e.createdAt).toISOString().split('T')[0]}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${getMoodLabel(e.mood).color} text-white text-[9px] font-bold px-2 py-0.5 rounded uppercase`}>
                              {getMoodLabel(e.mood).label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${getAnxietyLabel(e.anxiety).color} text-[9px] font-bold px-2 py-0.5 rounded border uppercase`}>
                              {getAnxietyLabel(e.anxiety).label}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`${getSleepLabel(e.sleepQuality).color} text-[9px] font-bold px-2 py-0.5 rounded border uppercase`}>
                              {getSleepLabel(e.sleepQuality).label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-bold text-green-600">
                               {((Math.max(0, Math.min(10, (e.sentiment || 0) + 5)) * 0.4 + ((5 - (e.mood || 3)) * 2.5) * 0.3 + Math.max(0, Math.min(10, 10 - (e.anxiety || 0))) * 0.3)).toFixed(1)}/10
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 italic max-w-xs truncate">
                            {e.text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeMenu === 'Feedback' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">Counselor Feedback</h3>
                  <p className="text-xs text-slate-400">Messages and recommendations from your counselor</p>
                </div>
                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border border-indigo-100">
                  {counselorSuggestions.length} Message{counselorSuggestions.length !== 1 ? 's' : ''}
                </span>
              </div>

              {counselorSuggestions.length === 0 ? (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center">
                  <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <h4 className="text-sm font-bold text-slate-600 mb-1">No Feedback Yet</h4>
                  <p className="text-xs text-slate-400">Your counselor hasn't sent any feedback. Keep submitting assessments.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {counselorSuggestions.map((s, i) => (
                    <div
                      key={s._id}
                      className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform">
                            {(s.counselor?.name || 'C').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-black text-slate-800 text-sm">{s.counselor?.name || 'Your Counselor'}</p>
                            <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest">Counselor</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                            {new Date(s.createdAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <p className="text-[9px] text-slate-300 font-bold mt-0.5">
                            {new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>

                      {/* Message */}
                      <div className="bg-gradient-to-br from-indigo-50 to-slate-50 rounded-2xl p-6 border border-indigo-100/60 relative">
                        <span className="absolute top-3 left-4 text-4xl text-indigo-200/60 font-serif leading-none select-none">"</span>
                        <p className="text-sm text-slate-700 font-medium leading-relaxed pl-4 pr-2 pt-2 italic">
                          {s.text}
                        </p>
                        <span className="absolute bottom-2 right-4 text-4xl text-indigo-200/60 font-serif leading-none select-none">"</span>
                      </div>

                      {/* Footer badge */}
                      <div className="flex items-center gap-2 mt-4">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Professional Recommendation</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Assessment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-8 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Submit Mental Health Assessment</h2>
                <p className="text-xs text-slate-500 mt-1">Please answer honestly. Your responses are confidential.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleSubmitAssessment} className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
              {/* Mood */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">1. How would you rate your overall mood today?</h3>
                <div className="space-y-2">
                  {[
                    { val: 1, label: 'Excellent' },
                    { val: 2, label: 'Good' },
                    { val: 3, label: 'Fair' },
                    { val: 4, label: 'Poor' }
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="mood" value={opt.val} checked={formData.mood === opt.val} onChange={e=>setFormData({...formData, mood: Number(e.target.value)})} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Anxiety */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">2. What is your anxiety level?</h3>
                <div className="space-y-2">
                  {[
                    { val: 0, label: 'None' },
                    { val: 3, label: 'Mild' },
                    { val: 7, label: 'Moderate' },
                    { val: 10, label: 'Severe' }
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="anxiety" value={opt.val} checked={formData.anxiety === opt.val} onChange={e=>setFormData({...formData, anxiety: Number(e.target.value)})} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Sleep */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">3. How would you rate your sleep quality?</h3>
                <div className="space-y-2">
                  {[
                    { val: 1, label: 'Excellent' },
                    { val: 2, label: 'Good' },
                    { val: 3, label: 'Fair' },
                    { val: 4, label: 'Poor' }
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="sleep" value={opt.val} checked={formData.sleepQuality === opt.val} onChange={e=>setFormData({...formData, sleepQuality: Number(e.target.value)})} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Social */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-800">4. How connected do you feel socially?</h3>
                <div className="space-y-2">
                  {[
                    { val: 1, label: 'Very Connected' },
                    { val: 2, label: 'Connected' },
                    { val: 4, label: 'Isolated' },
                    { val: 5, label: 'Very Isolated' }
                  ].map(opt => (
                    <label key={opt.val} className="flex items-center gap-3 cursor-pointer group">
                      <input type="radio" name="social" value={opt.val} checked={formData.socialInteraction === opt.val} onChange={e=>setFormData({...formData, socialInteraction: Number(e.target.value)})} className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500" />
                      <span className="text-sm text-slate-600 group-hover:text-slate-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                 <h3 className="text-sm font-bold text-slate-800">Additional Journal Notes</h3>
                 <textarea 
                  value={formData.text}
                  onChange={e=>setFormData({...formData, text: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[100px] outline-none focus:border-indigo-600 transition-colors text-sm"
                  placeholder="Share more about your day..."
                 />
              </div>

              <button className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-sm uppercase tracking-widest hover:bg-indigo-600 transition-all">
                Submit Assessment
              </button>
            </form>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
      `}} />
    </div>
  )
}
