import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList, Cell } from 'recharts'

export default function JournalChart({ data }) {
  const chartData = (data || []).slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(-7).map(e => ({
    date: new Date(e.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: Number(e.mood || 0) * 10 // Convert to percentage-like scale for "good" look
  }))

  const colors = ['#4c6ef5', '#40c057', '#e03131', '#be4bdb', '#f08c00', '#0ca678', '#adb5bd']

  return (
    <div className="w-full h-full font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
          <XAxis 
            dataKey="date" 
            axisLine={{ stroke: '#fff', strokeWidth: 1 }} 
            tickLine={false} 
            tick={{ fill: '#fff', fontSize: 10, fontWeight: 700 }}
            dy={10}
          />
          <YAxis 
            domain={[0, 100]} 
            axisLine={{ stroke: '#fff', strokeWidth: 1 }} 
            tickLine={false} 
            tick={{ fill: '#fff', fontSize: 10, fontWeight: 700 }}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip 
            cursor={{ fill: 'rgba(255,255,255,0.1)' }}
            contentStyle={{ 
              backgroundColor: '#1f2937', 
              border: 'none', 
              borderRadius: '8px', 
              color: '#fff',
              fontSize: '10px'
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
            <LabelList 
              dataKey="value" 
              position="top" 
              formatter={(v) => `${v}%`} 
              style={{ fill: '#fff', fontSize: 10, fontWeight: 900 }} 
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
