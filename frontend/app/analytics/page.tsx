'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import {
  ScatterChart, Scatter, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { analytics } from '@/lib/api'
import { CHART_COLORS } from '@/lib/utils'

export default function AnalyticsPage() {
  const [scatter,  setScatter]  = useState<any[]>([])
  const [seasonal, setSeasonal] = useState<any[]>([])
  const [language, setLanguage] = useState<any[]>([])
  const [genres,   setGenres]   = useState<any[]>([])
  const [directors,setDirectors]= useState<any[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([
      analytics.scatter(),
      analytics.seasonal(),
      analytics.language(),
      analytics.genres(),
      analytics.topDirectors(),
    ]).then(([s, se, l, g, d]) => {
      setScatter(s)
      setSeasonal(se)
      setLanguage(l)
      setGenres(g.map((x: any) => ({ ...x, avg_revenue: Math.round(x.avg_revenue / 1e6) })))
      setDirectors(d)
    }).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="font-display text-2xl tracking-widest text-yellow-400">LOADING...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">Business Intelligence</p>
        <h1 className="font-display text-5xl tracking-widest">ANALYTICS STUDIO</h1>
        <p className="mt-1 text-sm text-gray-500">
          Interactive drill-downs — genre, language, region, seasonal performance
        </p>
      </div>

      {/* Filter Bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
        <span className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">Filters:</span>
        {['Genre','Region','Year Range'].map((f) => (
          <select key={f} className="input-field w-auto text-xs">
            <option>All {f}s</option>
          </select>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <ChartCard title="BUDGET VS REVENUE" subtitle="Production cost vs box office ($M)" badge="SCATTER" badgeColor="cyan">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis type="number" dataKey="budget"  name="Budget"  tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} label={{ value: 'Budget ($M)', position: 'insideBottom', fill: '#8892a4', fontSize: 10 }} />
              <YAxis type="number" dataKey="revenue" name="Revenue" tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
                if (!payload?.length) return null
                const p = payload[0].payload
                return (
                  <div className="rounded-lg border border-white/10 bg-filmiq-bg2 px-3 py-2 text-xs">
                    <p className="font-medium text-white">{p.title}</p>
                    <p className="text-yellow-400">Revenue: ${p.revenue?.toFixed(0)}M</p>
                    <p className="text-gray-400">Budget: ${p.budget?.toFixed(0)}M</p>
                  </div>
                )
              }} />
              <Scatter data={scatter.slice(0, 60)} fill="#d4a843" opacity={0.7} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="SEASONAL PERFORMANCE" subtitle="Avg revenue index by release month" badge="HEATMAP" badgeColor="gold">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={seasonal}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="month" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip content={<GoldTooltip formatter={(v) => `$${v}M avg`} />} />
              <Bar dataKey="avg_revenue" name="Avg Revenue ($M)" radius={[4, 4, 0, 0]}>
                {seasonal.map((d, i) => (
                  <Cell key={i} fill={d.avg_revenue > 140 ? '#d4a843' : d.avg_revenue > 100 ? '#38d9f5' : '#8892a4'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="TOP DIRECTORS" subtitle="Cumulative box office revenue">
          <div className="space-y-3 mt-1">
            {directors.slice(0,8).map((d) => (
              <div key={d.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 font-medium">{d.name}</span>
                  <span className="font-mono text-yellow-400">${(d.total_revenue/1e9).toFixed(1)}B</span>
                </div>
                <div className="h-1 rounded-full bg-white/[0.07]">
                  <div className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-300"
                    style={{ width: `${(d.total_revenue / (directors[0]?.total_revenue || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard title="LANGUAGE DISTRIBUTION" subtitle="Revenue share by original language">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={language} dataKey="total" nameKey="language" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {language.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number | string) => [`$${v}B`, '']} />
              <Legend iconSize={8} formatter={(v) => <span style={{ color: '#8892a4', fontSize: 11 }}>{v.toUpperCase()}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="GENRE REVENUE RANK" subtitle="Average revenue per genre">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={genres.slice(0,8)} layout="vertical">
              <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 9 }} tickFormatter={(v) => `$${v}M`} />
              <YAxis type="category" dataKey="genre" tick={{ fill: '#8892a4', fontSize: 10 }} width={80} />
              <Tooltip content={<GoldTooltip formatter={(v) => `$${v}M avg`} />} />
              <Bar dataKey="avg_revenue" name="Avg ($M)" radius={[0, 3, 3, 0]}>
                {genres.slice(0,8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
