'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { MoviePoster } from '@/components/ui/MoviePoster'
import { movies } from '@/lib/api'
import type { Movie } from '@/lib/api'
import { formatMoney } from '@/lib/utils'
import { CHART_COLORS } from '@/lib/utils'

const MAX_COMPARE = 5

export default function ComparePage() {
  const [query,     setQuery]     = useState('')
  const [results,   setResults]   = useState<Movie[]>([])
  const [selected,  setSelected]  = useState<Movie[]>([])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    const timer = setTimeout(() => {
      movies.search(q).then(setResults).catch(console.error)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function addMovie(m: Movie) {
    if (selected.length >= MAX_COMPARE || selected.some((s) => s.id === m.id)) return
    setSelected((s) => [...s, m])
    setQuery('')
    setResults([])
  }

  function removeMovie(id: number) {
    setSelected((s) => s.filter((m) => m.id !== id))
  }

  const maxRevenue = Math.max(1, ...selected.map((m) => m.revenue))
  const maxBudget  = Math.max(1, ...selected.map((m) => m.budget))
  const maxPop     = Math.max(1, ...selected.map((m) => m.popularity))
  const maxVotes   = Math.max(1, ...selected.map((m) => m.vote_count ?? 0))
  const maxRuntime = Math.max(1, ...selected.map((m) => m.runtime ?? 0))

  const radarData = [
    { metric: 'Rating',     ...Object.fromEntries(selected.map((m) => [m.title, (m.vote_average / 10) * 100])) },
    { metric: 'Popularity', ...Object.fromEntries(selected.map((m) => [m.title, (m.popularity / maxPop) * 100])) },
    { metric: 'Revenue',    ...Object.fromEntries(selected.map((m) => [m.title, (m.revenue / maxRevenue) * 100])) },
    { metric: 'Budget',     ...Object.fromEntries(selected.map((m) => [m.title, (m.budget / maxBudget) * 100])) },
    { metric: 'Votes',      ...Object.fromEntries(selected.map((m) => [m.title, ((m.vote_count ?? 0) / maxVotes) * 100])) },
    { metric: 'Runtime',    ...Object.fromEntries(selected.map((m) => [m.title, ((m.runtime ?? 0) / maxRuntime) * 100])) },
  ]

  const revenueData = selected.map((m) => ({ title: m.title, revenue: Math.round(m.revenue / 1e6), budget: Math.round(m.budget / 1e6) }))

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">Side-by-Side Analysis</p>
        <h1 className="text-4xl font-bold text-navy">Movie Comparison Tool</h1>
        <p className="mt-1 text-sm text-slate-400">Compare 2–5 movies on rating, popularity, votes, budget, revenue, and runtime</p>
      </div>

      {selected.length < MAX_COMPARE && (
        <div className="mb-6 card p-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search to add a movie (${selected.length}/${MAX_COMPARE})…`}
              className="input-field pl-9"
            />
          </div>
          {results.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              {results.map((m) => (
                <button key={m.id} onClick={() => addMovie(m)} className="group text-left">
                  <MoviePoster src={m.poster_url} title={m.title} className="aspect-[2/3] w-full" />
                  <p className="mt-1 truncate text-xs font-medium text-slate-700 group-hover:text-brand">{m.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-slate-500">Search and add at least 2 movies to compare.</p>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-wrap gap-3">
            {selected.map((m) => (
              <div key={m.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm">
                <span className="font-medium text-slate-700">{m.title}</span>
                <button onClick={() => removeMovie(m.id)} className="text-slate-400 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>

          {selected.length >= 2 && (
            <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <ChartCard title="Multi-Metric Radar" subtitle="Normalized to 0–100 within this comparison set">
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: '#64748b', fontSize: 11 }} />
                    <PolarRadiusAxis tick={{ fill: '#94a3b8', fontSize: 9 }} />
                    {selected.map((m, i) => (
                      <Radar key={m.id} name={m.title} dataKey={m.title} stroke={CHART_COLORS[i % CHART_COLORS.length]} fill={CHART_COLORS[i % CHART_COLORS.length]} fillOpacity={0.15} />
                    ))}
                    <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
                  </RadarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Budget vs. Revenue" subtitle="In millions USD">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={revenueData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="title" tick={{ fill: '#94a3b8', fontSize: 9 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                    <Tooltip content={<GoldTooltip formatter={(v) => `$${v}M`} />} />
                    <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
                    <Bar dataKey="budget" name="Budget" fill="#8892a4" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#d4a843" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          <ChartCard title="Comparison Table">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Movie', 'Year', 'Rating', 'Votes', 'Popularity', 'Budget', 'Revenue', 'Runtime'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-800">{m.title}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">{m.year ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-sm">★ {m.vote_average.toFixed(1)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">{(m.vote_count ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">{m.popularity.toFixed(0)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">{formatMoney(m.budget, true)}</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-brand">{formatMoney(m.revenue, true)}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-500">{m.runtime ? `${m.runtime} min` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </>
      )}
    </div>
  )
}
