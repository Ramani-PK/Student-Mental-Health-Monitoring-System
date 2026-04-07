const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const http = require('http')
const { Server } = require('socket.io')
const nodemailer = require('nodemailer')
require('dotenv').config()

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

io.on('connection', socket => {
  socket.on('joinRole', role => {
    if (role) socket.join(role)
  })
})

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/mental_health'
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err))

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['student','admin','counselor'], required: true }
}, { timestamps: true })

const journalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  sentiment: { type: Number, required: true },
  risk: { type: String, enum: ['low','medium','high','critical'], required: true },
  day: { type: Number },
  anxiety: { type: Number },
  sadness: { type: Number },
  stressLevel: { type: Number },
  sleepQuality: { type: Number },
  mood: { type: Number },
  academicPressure: { type: Number },
  socialInteraction: { type: Number },
  energyLevel: { type: Number },
  appetite: { type: Number },
  physicalHealth: { type: Number },
  suggestions: [{ type: String }]
}, { timestamps: true })

const suggestionSchema = new mongoose.Schema({
  counselor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true }
}, { timestamps: true })

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  risk: { type: String, enum: ['low','medium','high','critical'], required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['Active', 'Acknowledged', 'Resolved'], default: 'Active' },
  acknowledged: { type: Boolean, default: false }
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const JournalEntry = mongoose.model('JournalEntry', journalSchema)
const Suggestion = mongoose.model('Suggestion', suggestionSchema)
const Alert = mongoose.model('Alert', alertSchema)

function analyzeText(t) {
  const s = t.toLowerCase()
  const positives = ['happy','good','calm','relaxed','hopeful','grateful','confident','supported']
  const negatives = ['sad','bad','anxious','depressed','panic','stress','stressed','lonely','tired','exhausted','overwhelmed','angry','hopeless']
  const criticals = ['suicide','kill myself','harm myself','self-harm','end it','no reason to live']
  let score = 0
  for (const w of positives) if (s.includes(w)) score += 1
  for (const w of negatives) if (s.includes(w)) score -= 1
  let risk = 'low'
  if (criticals.some(w => s.includes(w))) risk = 'critical'
  else if (negatives.filter(w => s.includes(w)).length >= 3 || s.includes('depressed') || s.includes('panic')) risk = 'high'
  else if (negatives.filter(w => s.includes(w)).length >= 1 || s.includes('stress') || s.includes('anxious')) risk = 'medium'
  const suggestions = []
  if (risk !== 'low') suggestions.push('Try a 5-minute breathing exercise')
  if (risk === 'high' || risk === 'critical') suggestions.push('Reach out to faculty or counselor immediately')
  if (s.includes('lonely')) suggestions.push('Connect with peers or join a campus group')
  if (s.includes('tired') || s.includes('exhausted')) suggestions.push('Adjust sleep schedule and reduce workload')
  return { sentiment: score, risk, suggestions }
}

const MAIL_HOST = process.env.MAIL_HOST
const MAIL_PORT = process.env.MAIL_PORT
const MAIL_USER = process.env.MAIL_USER
const MAIL_PASS = process.env.MAIL_PASS
const MAIL_FROM = process.env.MAIL_FROM || 'alerts@system.local'
let transporter = null
if (MAIL_HOST && MAIL_PORT && MAIL_USER && MAIL_PASS) {
  transporter = nodemailer.createTransport({
    host: MAIL_HOST,
    port: Number(MAIL_PORT),
    auth: { user: MAIL_USER, pass: MAIL_PASS }
  })
}

async function notifyAlert(user, alertDoc) {
  const payload = {
    id: alertDoc._id.toString(),
    user: { id: user._id.toString(), name: user.name, email: user.email },
    risk: alertDoc.risk,
    message: alertDoc.message,
    createdAt: alertDoc.createdAt
  }

  io.to('counselor').emit('alert', payload)
  io.to('admin').emit('alert', payload)
  
  // Fetch all counselors and admins to notify via email
  const staffs = await User.find({ role: { $in: ['admin', 'counselor'] } }).select('email')
  let recipients = staffs.map(u => u.email)

  // Also include from env vars if any
  const envEmails = (process.env.ALERT_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)
  recipients = [...new Set([...recipients, ...envEmails])]

  if (transporter && recipients.length > 0) {
    try {
      const lines = [
        `Mental health alert detected!`,
        `Name: ${user.name} (${user.email})`,
        `Risk: ${alertDoc.risk}`,
        `Message: ${alertDoc.message}`,
        `Time: ${new Date(alertDoc.createdAt).toLocaleString()}`,
        `Please check the dashboard for more details.`
      ];
      await transporter.sendMail({
        from: MAIL_FROM,
        to: recipients.join(', '),
        subject: `Mental health alert: ${user.name} (${alertDoc.risk})`,
        text: lines.join('\n')
      })
    } catch (err) {
      console.error('Email alert failed:', err)
    }
  }
}

function auth(req,res,next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'unauthorized' })
  try {
    const data = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret')
    req.user = data
    next()
  } catch {
    res.status(401).json({ error: 'invalid_token' })
  }
}

function requireRole(...roles) {
  return (req,res,next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'forbidden' })
    next()
  }
}

app.post('/api/auth/register', async (req,res) => {
  try {
    console.log('Register request received:', req.body)
    let { name, email, password, role } = req.body
    if (!name || !email || !password || !role) {
      console.log('Registration failed: missing fields')
      return res.status(400).json({ error: 'missing_fields' })
    }
    email = email.toLowerCase().trim()
    const exists = await User.findOne({ email })
    if (exists) {
      console.log('Registration failed: email in use')
      return res.status(409).json({ error: 'email_in_use' })
    }
    const hash = await bcrypt.hash(password, 10)
    const user = await User.create({ name, email, password: hash, role })
    console.log('Registration success (DB):', user._id)
    const token = jwt.sign({ id: user._id.toString(), role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
    res.json({ token, role: user.role, name: user.name, email: user.email, id: user._id.toString() })
  } catch (e) {
    console.error('Registration error:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.post('/api/auth/login', async (req,res) => {
  try {
    let { email, password } = req.body
    if (!email || !password) return res.status(400).json({ error: 'missing_fields' })
    email = email.toLowerCase().trim()
    const user = await User.findOne({ email })
    if (!user) return res.status(404).json({ error: 'not_found' })
    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' })
    const token = jwt.sign({ id: user._id.toString(), role: user.role, name: user.name, email: user.email }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' })
    res.json({ token, role: user.role, name: user.name, email: user.email, id: user._id.toString() })
  } catch (e) {
    console.error('Login error:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/users', auth, requireRole('admin'), async (req,res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    res.json(users)
  } catch (e) {
    console.error('Error fetching users:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.delete('/api/users/:id', auth, requireRole('admin'), async (req,res) => {
  try {
    await User.findByIdAndDelete(req.params.id)
    res.json({ success: true })
  } catch (e) {
    console.error('Error deleting user:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/users/me', auth, async (req,res) => {
  try {
    const user = await User.findById(req.user.id).select('-password')
    if (!user) return res.status(404).json({ error: 'not_found' })
    const userData = user.toObject()
    userData.id = userData._id.toString()
    res.json(userData)
  } catch (e) {
    console.error('Error fetching me:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.post('/api/journal', auth, requireRole('student'), async (req,res) => {
  try {
    const { text, day, anxiety, sadness, stressLevel, sleepQuality, mood, academicPressure, socialInteraction, energyLevel, appetite, physicalHealth } = req.body
    if (!text) return res.status(400).json({ error: 'missing_text' })
    const analysis = analyzeText(text)
    const d = Number(day) || 0
    const a = Number(anxiety) || 0
    const s = Number(sadness) || 0
    const sl = Number(stressLevel) || 0
    const sq = Number(sleepQuality) || 0
    const md = Number(mood) || 0
    const ap = Number(academicPressure) || 0
    const si = Number(socialInteraction) || 0
    const en = Number(energyLevel) || 0
    const ap_val = Number(appetite) || 0
    const ph = Number(physicalHealth) || 0
    let risk = analysis.risk
    if (a >= 9 || s >= 9) risk = 'critical'
    else if (a >= 7 || s >= 7) risk = 'high'
    else if ((a >= 4 || s >= 4) && risk === 'low') risk = 'medium'
    const suggestions = [...analysis.suggestions]
    if (a >= 7 || s >= 7) suggestions.push('Consider contacting support or counselor')
    if (d <= 2) suggestions.push('List three positives from today')
    if (sl >= 4) suggestions.push('Try a short mindfulness session to reduce stress')
    if (sq >= 4) suggestions.push('Aim for consistent sleep routine tonight')
    if (md >= 4) suggestions.push('Reach out to someone you trust')
    if (ap >= 4) suggestions.push('Break tasks into smaller chunks and prioritize')
    if (si >= 4) suggestions.push('Schedule a short chat with a friend/family')
    if (en >= 4) suggestions.push('Take a brief walk and hydrate')
    if (ap_val >= 4) suggestions.push('Maintain a healthy and regular diet')
    if (ph >= 4) suggestions.push('Schedule a check-up if feeling unwell')
    if (sl >= 5 || sq >= 5 || md >= 5 || ap >= 5) risk = 'high'
    if ((sl >= 5 && (sq >= 5 || md >= 5)) || (ap >= 5 && md >= 5)) risk = 'critical'
    
    const entry = await JournalEntry.create({ user: req.user.id, text, sentiment: analysis.sentiment, risk, day: d, anxiety: a, sadness: s, stressLevel: sl, sleepQuality: sq, mood: md, academicPressure: ap, socialInteraction: si, energyLevel: en, appetite: ap_val, physicalHealth: ph, suggestions })
    
    if (risk === 'high' || risk === 'critical') {
      const user = await User.findById(req.user.id)
      if (user) {
        const alert = await Alert.create({ user: user._id, risk, message: text })
        await notifyAlert(user, alert)
      }
    }
    res.json(entry)
  } catch (e) {
    console.error('Error creating journal entry:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/journal', auth, requireRole('student'), async (req,res) => {
  try {
    const entries = await JournalEntry.find({ user: req.user.id }).sort({ createdAt: 1 })
    res.json(entries)
  } catch (e) {
    console.error('Error fetching journal entries:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/alerts', auth, requireRole('admin','counselor'), async (req,res) => {
  try {
    const alerts = await Alert.find().sort({ createdAt: -1 }).populate('user','name email')
    const alertsWithSuggestions = await Promise.all(alerts.map(async (a) => {
      const suggestion = await Suggestion.findOne({ student: a.user?._id }).sort({ createdAt: -1 }).populate('counselor', 'name')
      return { ...a.toObject(), latestSuggestion: suggestion }
    }))
    res.json(alertsWithSuggestions)
  } catch (e) {
    console.error('Error fetching alerts:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

// Student: fetch their own alerts to see current status/stage
app.get('/api/my-alerts', auth, requireRole('student'), async (req,res) => {
  try {
    const alerts = await Alert.find({ user: req.user.id }).sort({ createdAt: -1 })
    res.json(alerts)
  } catch (e) {
    console.error('Error fetching my alerts:', e)
    res.status(500).json({ error: 'server_error' })
  }
})


app.patch('/api/alerts/:id/status', auth, requireRole('admin','counselor'), async (req,res) => {
  const { status } = req.body
  if (!['Active', 'Acknowledged', 'Resolved'].includes(status)) {
    return res.status(400).json({ error: 'invalid_status' })
  }
  try {
    const alert = await Alert.findByIdAndUpdate(req.params.id, { status }, { new: true })
    res.json(alert)
  } catch (e) {
    console.error('Error updating alert status:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/students', auth, requireRole('admin','counselor'), async (req,res) => {
  try {
    const students = await User.find({ role: 'student' }).select('-password')
    const studentsWithData = await Promise.all(students.map(async (s) => {
      const suggestion = await Suggestion.findOne({ student: s._id }).sort({ createdAt: -1 }).populate('counselor', 'name')
      const entries = await JournalEntry.find({ user: s._id }).sort({ createdAt: -1 })
      const latestEntry = entries[0]
      
      // Calculate latest score
      let latestScore = 0
      if (latestEntry) {
        const sScore = Math.max(0, Math.min(10, (latestEntry.sentiment || 0) + 5))
        const mScore = (5 - (latestEntry.mood || 3)) * 2.5
        const aScore = Math.max(0, Math.min(10, 10 - (latestEntry.anxiety || 0)))
        latestScore = (sScore * 0.4 + mScore * 0.3 + aScore * 0.3)
      }

      return { 
        ...s.toObject(), 
        latestSuggestion: suggestion, 
        latestRisk: latestEntry?.risk || 'low',
        lastAssessmentDate: latestEntry?.createdAt || null,
        latestScore: latestScore.toFixed(1)
      }
    }))
    res.json(studentsWithData)
  } catch (e) {
    console.error('Error fetching students:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/counselors', auth, requireRole('admin'), async (req,res) => {
  try {
    const counselors = await User.find({ role: 'counselor' }).select('-password')
    const counselorsWithStats = await Promise.all(counselors.map(async (c) => {
      const responseCount = await Suggestion.countDocuments({ counselor: c._id })
      return { ...c.toObject(), responseCount }
    }))
    res.json(counselorsWithStats)
  } catch (e) {
    console.error('Error fetching counselors:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/dashboard-stats', auth, requireRole('admin', 'counselor'), async (req,res) => {
  try {
    const totalStudents = await User.countDocuments({ role: 'student' })
    const criticalAlerts = await Alert.countDocuments({ 
      risk: { $in: ['critical', 'high'] }, 
      status: { $in: ['Active', 'Acknowledged'] } 
    })
    const reportsGenerated = await Suggestion.countDocuments()
    
    const entries = await JournalEntry.find()
    let avgScore = 0
    if (entries.length > 0) {
      const total = entries.reduce((acc, entry) => {
        const sScore = Math.max(0, Math.min(10, (entry.sentiment || 0) + 5))
        const mScore = (5 - (entry.mood || 3)) * 2.5
        const aScore = Math.max(0, Math.min(10, 10 - (entry.anxiety || 0)))
        return acc + (sScore * 0.4 + mScore * 0.3 + aScore * 0.3)
      }, 0)
      avgScore = (total / entries.length).toFixed(1)
    }

    // Mood distribution
    const moodCounts = { Excellent: 0, Good: 0, Fair: 0, Poor: 0 }
    entries.forEach(e => {
      if (e.mood >= 5) moodCounts.Excellent++
      else if (e.mood >= 4) moodCounts.Good++
      else if (e.mood >= 3) moodCounts.Fair++
      else moodCounts.Poor++
    })
    const totalEntries = entries.length || 1
    const moodDist = Object.keys(moodCounts).reduce((acc, key) => {
      acc[key] = Math.round((moodCounts[key] / totalEntries) * 100)
      return acc
    }, {})

    // Risk levels - Based on students' latest assessment
    const students = await User.find({ role: 'student' })
    const riskLevels = { Low: 0, Medium: 0, High: 0, Critical: 0 }
    
    for (const s of students) {
      const latestEntry = await JournalEntry.findOne({ user: s._id }).sort({ createdAt: -1 })
      const risk = latestEntry?.risk || 'low'
      if (risk === 'critical') riskLevels.Critical++
      else if (risk === 'high') riskLevels.High++
      else if (risk === 'medium') riskLevels.Medium++
      else riskLevels.Low++
    }

    // Trend data (Last 6 months)
    const trend = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthEntries = await JournalEntry.find({ createdAt: { $gte: d, $lt: nextD } })
      
      let mAvg = 0
      if (monthEntries.length > 0) {
        const mTotal = monthEntries.reduce((acc, e) => {
          const sScore = Math.max(0, Math.min(10, (e.sentiment || 0) + 5))
          const mScore = (5 - (e.mood || 3)) * 2.5
          const aScore = Math.max(0, Math.min(10, 10 - (e.anxiety || 0)))
          return acc + (sScore * 0.4 + mScore * 0.3 + aScore * 0.3)
        }, 0)
        mAvg = parseFloat((mTotal / monthEntries.length).toFixed(1))
      } else {
        mAvg = 7.0 // Fallback for months with no data
      }
      trend.push({ month: d.toLocaleString('default', { month: 'short' }), score: mAvg })
    }

    // Recent Activity
    const latestEntries = await JournalEntry.find().sort({ createdAt: -1 }).limit(3).populate('user', 'name')
    const latestAlerts = await Alert.find().sort({ createdAt: -1 }).limit(3).populate('user', 'name')
    const latestSuggestions = await Suggestion.find().sort({ createdAt: -1 }).limit(3).populate('counselor', 'name')
    
    const recentActivity = [
      ...latestEntries.map(e => ({ type: 'Assessment', user: e.user?.name, time: e.createdAt, text: `New assessment submitted by ${e.user?.name}` })),
      ...latestAlerts.map(a => ({ type: 'Alert', user: a.user?.name, time: a.createdAt, text: `${a.risk.toUpperCase()} alert for ${a.user?.name}` })),
      ...latestSuggestions.map(s => ({ type: 'Feedback', user: s.counselor?.name, time: s.createdAt, text: `Feedback sent by ${s.counselor?.name}` }))
    ].sort((a,b) => new Date(b.time) - new Date(a.time)).slice(0, 5)

    res.json({
      totalStudents,
      criticalAlerts,
      reportsGenerated,
      avgScore,
      moodDist,
      riskLevels,
      trend,
      recentActivity
    })
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/analytics', auth, requireRole('admin', 'counselor'), async (req,res) => {
  try {
    const entries = await JournalEntry.find()
    const now = new Date()
    const trendData = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const monthEntries = entries.filter(e => e.createdAt >= d && e.createdAt < nextD)
      
      let avgSentiment = 0
      let avgMood = 0
      let avgStress = 0
      
      if (monthEntries.length > 0) {
        avgSentiment = monthEntries.reduce((acc, e) => acc + (e.sentiment || 0), 0) / monthEntries.length
        avgMood = monthEntries.reduce((acc, e) => acc + (e.mood || 0), 0) / monthEntries.length
        avgStress = monthEntries.reduce((acc, e) => acc + (e.stressLevel || 0), 0) / monthEntries.length
      }
      
      trendData.push({
        month: d.toLocaleString('default', { month: 'short' }),
        sentiment: parseFloat(avgSentiment.toFixed(1)),
        mood: parseFloat(avgMood.toFixed(1)),
        stress: parseFloat(avgStress.toFixed(1))
      })
    }

    const moodDist = [
      { name: 'Excellent', value: entries.filter(e => e.mood >= 5).length },
      { name: 'Good', value: entries.filter(e => e.mood >= 4 && e.mood < 5).length },
      { name: 'Fair', value: entries.filter(e => e.mood >= 3 && e.mood < 4).length },
      { name: 'Poor', value: entries.filter(e => e.mood < 3).length }
    ]

    const riskLevels = [
      { name: 'Low', value: entries.filter(e => e.risk === 'low').length },
      { name: 'Medium', value: entries.filter(e => e.risk === 'medium').length },
      { name: 'High', value: entries.filter(e => e.risk === 'high').length },
      { name: 'Critical', value: entries.filter(e => e.risk === 'critical').length }
    ]

    res.json({ trendData, moodDist, riskLevels })
  } catch (e) {
    console.error('Error fetching analytics:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

 app.get('/api/counselors/:id/responses', auth, requireRole('admin'), async (req,res) => {
  try {
    const responses = await Suggestion.find({ counselor: req.params.id }).sort({ createdAt: -1 }).populate('student', 'name email')
    res.json(responses)
  } catch (e) {
    console.error('Error fetching responses:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/students/:id/journal', auth, requireRole('admin','counselor'), async (req,res) => {
  try {
    const entries = await JournalEntry.find({ user: req.params.id }).sort({ createdAt: -1 })
    res.json(entries)
  } catch (e) {
    console.error('Error fetching student journal:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.post('/api/suggestions', auth, requireRole('counselor'), async (req,res) => {
  try {
    const { studentId, text } = req.body
    if (!studentId || !text) return res.status(400).json({ error: 'missing_fields' })
    const suggestion = await Suggestion.create({ counselor: req.user.id, student: studentId, text })
    res.json(suggestion)
  } catch (e) {
    console.error('Error creating suggestion:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

app.get('/api/suggestions/:studentId', auth, async (req,res) => {
  try {
    const suggestions = await Suggestion.find({ student: req.params.studentId }).sort({ createdAt: -1 }).populate('counselor', 'name')
    res.json(suggestions)
  } catch (e) {
    console.error('Error fetching suggestions:', e)
    res.status(500).json({ error: 'server_error' })
  }
})

const PORT = process.env.PORT || 4002

server.listen(PORT, () => {
  console.log('server running on port', PORT)
})
