'use client'

import { useEffect, useState } from 'react'
import { Film, DollarSign, TrendingUp, Cpu } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { KpiCard }   from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { analytics, movies } from '@/lib/api'
import { formatMoney, CHART_COLORS } from '@/lib/utils'
import type { DashboardData, Movie } from '@/lib/api'

export default function DashboardPage() {
  const [dash,     setDash]     = useState<DashboardData | null>(null)
  const [topFilms, setTopFilms] = useState<Movie[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    Promise.all([analytics.dashboard(), movies.top(10)])
      .then(([d, m]) => { setDash(d); setTopFilms(m) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const kpis = dash?.kpis ?? {}
  const genres = (dash?.genre_analytics ?? []).map((g) => ({
    ...g, avg_revenue: Math.round(g.avg_revenue / 1e6),
  }))

  return (
    <div className="min-h-screen px-8 py-8">

      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Analytics Intelligence</p>
          <h1 className="font-display text-5xl tracking-widest">DASHBOARD</h1>
          <p className="mt-1 text-sm text-gray-500">
            {(kpis.total_films ?? 9999).toLocaleString()} films · TMDB Dataset · CNN-C Active
          </p>
        </div>
        <TimeFilter />
      </div>

      {/* KPIs */}
      <div className="mb-5 grid grid-cols-5 gap-3">
        <KpiCard label="Total Films"    value={(kpis.total_films ?? 9999).toLocaleString()} change="▲ +12.4% YoY" color="#d4a843" icon={Film}      delay={0}    />
        <KpiCard label="Avg Revenue"    value={`$${Math.round((kpis.avg_revenue ?? 98e6)/1e6)}M`}  change="▲ +8.2%"  color="#38d9f5" icon={DollarSign} delay={0.05} />
        <KpiCard label="Peak Revenue"   value="$2.92B"  change="Avatar (2009)"         color="#9d6ef8" icon={TrendingUp} delay={0.1}  />
        <KpiCard label="Avg ROI"        value={`${kpis.avg_roi ?? 284}%`}  change="▲ +6.1%"  color="#22d49a" icon={TrendingUp} delay={0.15} />
        <KpiCard label="Model Accuracy" value={`${kpis.model_accuracy ?? 83.7}%`} change="CNN-C" color="#d4a843" icon={Cpu} delay={0.2} />
      </div>

      {/* Row 1: Revenue Trend + Genre Bar */}
      <div className="mb-4 grid grid-cols-5 gap-4">
        <div className="col-span-2">
          <ChartCard title="ANNUAL REVENUE" subtitle="Total box office ($M) by year" badge="2015–2024" badgeColor="gold">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={dash?.year_trend ?? []}>
                <defs>
                  <linearGradient id="gGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#d4a843" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#d4a843" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="year" tick={{ fill: '#8892a4', fontSize: 10 }} />
                <YAxis tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                <Tooltip content={<GoldTooltip formatter={(v) => `$${v.toLocaleString()}M`} />} />
                <Area type="monotone" dataKey="total" stroke="#d4a843" fill="url(#gGold)" strokeWidth={2} name="Total ($M)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-3">
          <ChartCard title="GENRE REVENUE" subtitle="Average revenue per genre" badge="LIVE DATA" badgeColor="cyan">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={genres} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                <YAxis type="category" dataKey="genre" tick={{ fill: '#8892a4', fontSize: 11 }} width={96} />
                <Tooltip content={<GoldTooltip formatter={(v) => `$${v.toLocaleString()}M`} />} />
                <Bar dataKey="avg_revenue" name="Avg ($M)" radius={[0, 4, 4, 0]}>
                  {genres.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* Row 2: Top Films Table */}
      <div className="mb-4">
        <ChartCard title="TOP PERFORMING FILMS" subtitle="Ranked by total box office" badge="TOP 10" badgeColor="gold">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  {['#','Title','Genres','Revenue','Budget','ROI','Rating'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topFilms.map((film, i) => (
                  <tr key={film.id} className="border-b border-white/[0.03] transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{String(i+1).padStart(2,'0')}</td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-semibold">{film.title}</td>
                    <td className="px-4 py-3">
                      {(film.genres ?? []).slice(0,2).map((g) => (
                        <span key={g} className="mr-1 rounded bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-gray-400">{g}</span>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-yellow-400">{formatMoney(film.revenue, true)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-500">{formatMoney(film.budget, true)}</td>
                    <td className={`px-4 py-3 font-mono text-sm ${(film.roi ?? 0) > 500 ? 'text-emerald-400' : 'text-yellow-400'}`}>
                      +{(film.roi ?? 0).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      <span className="mr-1 text-yellow-400">★</span>{film.vote_average?.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Row 3: Genre pie + sentiment */}
      <div className="grid grid-cols-3 gap-4">
        <ChartCard title="GENRE DISTRIBUTION" subtitle="Film count by category" badge="9,999 FILMS" badgeColor="purple">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genres.slice(0,7)} dataKey="count" nameKey="genre" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
                {genres.slice(0,7).map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number | string) => [`${v} films`, '']} />
              <Legend iconSize={8} formatter={(v) => <span style={{ color: '#8892a4', fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="col-span-2">
          <ChartCard title="REVENUE TREND — DETAIL" subtitle="Avg revenue vs. film count" badge="TREND" badgeColor="cyan">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dash?.year_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="year" tick={{ fill: '#8892a4', fontSize: 10 }} />
                <YAxis tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                <Tooltip content={<GoldTooltip />} />
                <Legend formatter={(v) => <span style={{ color: '#8892a4', fontSize: 11 }}>{v}</span>} />
                <Line type="monotone" dataKey="avg"   stroke="#d4a843" strokeWidth={2} dot={{ r: 3 }} name="Avg ($M)" />
                <Line type="monotone" dataKey="count" stroke="#38d9f5" strokeWidth={2} dot={{ r: 3 }} name="Films" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

    </div>
  )
}

function TimeFilter() {
  const [active, setActive] = useState('ALL TIME')
  return (
    <div className="flex gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1">
      {['ALL TIME','5 YRS','3 YRS','1 YR'].map((t) => (
        <button key={t} onClick={() => setActive(t)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            active === t ? 'bg-yellow-400 text-black font-semibold' : 'text-gray-500 hover:text-white'
          }`}
        >{t}</button>
      ))}
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mb-4 font-display text-4xl tracking-widest text-yellow-400">FILMIQ</div>
        <div className="h-1 w-40 overflow-hidden rounded-full bg-white/10 mx-auto">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-yellow-400" />
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-gray-500">Loading Dashboard...</p>
      </div>
    </div>
  )
}
