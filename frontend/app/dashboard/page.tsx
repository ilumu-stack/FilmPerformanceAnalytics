'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Film, DollarSign, TrendingUp, Star, Sparkles } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import Link from 'next/link'
import { ChartCard } from '@/components/ui/Cards'
import { KpiCard }   from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { MoviePoster } from '@/components/ui/MoviePoster'
import { analytics, movies } from '@/lib/api'
import { formatMoney, CHART_COLORS } from '@/lib/utils'
import type { DashboardData, Movie } from '@/lib/api'
import toast from 'react-hot-toast'

function UnauthorizedNotice() {
  const params = useSearchParams()
  useEffect(() => {
    if (params.get('unauthorized') === '1') {
      toast.error("You don't have permission to access that page.")
    }
  }, [params])
  return null
}

export default function DashboardPage() {
  const [dash,      setDash]      = useState<DashboardData | null>(null)
  const [topFilms,  setTopFilms]  = useState<Movie[]>([])
  const [topBudget, setTopBudget] = useState<Movie[]>([])
  const [insights,  setInsights]  = useState<string[]>([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      analytics.dashboard(),
      movies.top(10),
      movies.list(1, 5, { sort: 'budget' }),
      analytics.insights(),
    ])
      .then(([d, m, b, i]) => { setDash(d); setTopFilms(m); setTopBudget(b); setInsights(i.insights) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <PageLoader />

  const kpis   = dash?.kpis ?? {}
  const genres = (dash?.genre_analytics ?? []).map((g) => ({
    ...g, avg_revenue: Math.round(g.avg_revenue / 1e6),
  }))

  return (
    <div className="min-h-screen bg-filmiq-bg px-6 py-8">
      <Suspense><UnauthorizedNotice /></Suspense>

      {/* ── Page header ── */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Analytics Intelligence</p>
          <h1 className="text-4xl font-bold text-navy">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            {(kpis.total_films ?? 0).toLocaleString()} films · TMDB Dataset
          </p>
        </div>
        <TimeFilter />
      </div>

      {/* ── KPIs ── */}
      <div className="mb-6 grid grid-cols-5 gap-4">
        <KpiCard label="Total Films"    value={(kpis.total_films ?? 0).toLocaleString()} change={`${(kpis.films_with_financials ?? 0).toLocaleString()} with budget+revenue`} color="#2563eb" icon={Film}       delay={0}    />
        <KpiCard label="Avg Rating"     value={(kpis.avg_rating ?? 0).toFixed(1)}         change="across full catalog"                                                       color="#f59e0b" icon={Star}       delay={0.05} />
        <KpiCard label="Avg Revenue"    value={formatMoney(kpis.avg_revenue ?? 0, true)}  change="films with budget+revenue data"                                            color="#10b981" icon={DollarSign} delay={0.1}  />
        <KpiCard label="Peak Revenue"   value={formatMoney(kpis.peak_revenue ?? 0, true)} change={topFilms[0]?.title ?? ''}                                                  color="#8b5cf6" icon={TrendingUp} delay={0.15} />
        <KpiCard label="Avg ROI"        value={`${(kpis.avg_roi ?? 0).toFixed(0)}%`}      change="films with budget+revenue data"                                            color="#0f2142" icon={TrendingUp} delay={0.2}  />
      </div>

      {/* ── AI Insights ── */}
      {insights.length > 0 && (
        <div className="mb-6 card p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <h3 className="text-[15px] font-semibold text-navy">AI Insights</h3>
            <span className="text-xs text-slate-400">— generated from dataset statistics</span>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {insights.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Row 1: Revenue Trend + Genre Bar ── */}
      <div className="mb-5 grid grid-cols-5 gap-5">
        <div className="col-span-2">
          <ChartCard title="Annual Revenue" subtitle="Total box office ($M) by year" badge="All Years" badgeColor="blue">
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={dash?.year_trend ?? []}>
                <defs>
                  <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                <Tooltip content={<GoldTooltip formatter={(v) => `$${v.toLocaleString()}M`} />} />
                <Area type="monotone" dataKey="total" stroke="#2563eb" fill="url(#gBlue)" strokeWidth={2} name="Total ($M)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="col-span-3">
          <ChartCard title="Genre Revenue" subtitle="Average revenue per genre" badge="Live Data" badgeColor="green">
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={genres} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                <YAxis type="category" dataKey="genre" tick={{ fill: '#64748b', fontSize: 11 }} width={96} />
                <Tooltip content={<GoldTooltip formatter={(v) => `$${v.toLocaleString()}M`} />} />
                <Bar dataKey="avg_revenue" name="Avg ($M)" radius={[0, 4, 4, 0]}>
                  {genres.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Row 2: Top Films Table ── */}
      <div className="mb-5">
        <ChartCard title="Top Performing Films" subtitle="Ranked by total box office" badge="Top 10" badgeColor="blue">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['#','','Title','Genres','Revenue','Budget','ROI','Rating'].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topFilms.map((film, i) => (
                  <tr key={film.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{String(i+1).padStart(2,'0')}</td>
                    <td className="px-4 py-3">
                      <Link href={`/movies/${film.id}`}>
                        <MoviePoster src={film.poster_url} title={film.title} className="h-14 w-10" />
                      </Link>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-semibold text-slate-800">
                      <Link href={`/movies/${film.id}`} className="hover:text-brand">{film.title}</Link>
                    </td>
                    <td className="px-4 py-3">
                      {(film.genres ?? []).slice(0,2).map((g) => (
                        <span key={g} className="mr-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{g}</span>
                      ))}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-brand">{formatMoney(film.revenue, true)}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-400">{formatMoney(film.budget, true)}</td>
                    <td className={`px-4 py-3 font-mono text-sm font-semibold ${(film.roi ?? 0) > 500 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      +{(film.roi ?? 0).toFixed(0)}%
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">
                      <span className="mr-1 text-amber-400">★</span>
                      <span className="text-slate-600">{film.vote_average?.toFixed(1)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Genre pie + trend line ── */}
      <div className="grid grid-cols-3 gap-5">
        <ChartCard title="Genre Distribution" subtitle="Film count by category" badge={`${(kpis.total_films ?? 0).toLocaleString()} Films`} badgeColor="purple">
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={genres.slice(0,7)} dataKey="count" nameKey="genre" cx="50%" cy="50%" innerRadius={50} outerRadius={75}>
                {genres.slice(0,7).map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number | string) => [`${v} films`, '']} />
              <Legend iconSize={8} formatter={(v) => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="col-span-2">
          <ChartCard title="Revenue Trend — Detail" subtitle="Avg revenue vs. film count" badge="Trend" badgeColor="blue">
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dash?.year_trend ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                <Tooltip content={<GoldTooltip />} />
                <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
                <Line type="monotone" dataKey="avg"   stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Avg ($M)" />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Films" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      {/* ── Row 4: Budget leaders ── */}
      <div className="mt-5">
        <ChartCard title="Budget Leaders" subtitle="Highest production budgets in the catalog" badge="Top 5" badgeColor="red">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
            {topBudget.map((film) => (
              <Link key={film.id} href={`/movies/${film.id}`} className="group flex flex-col gap-2">
                <MoviePoster src={film.poster_url} title={film.title} className="aspect-[2/3] w-full" />
                <div>
                  <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-brand">{film.title}</p>
                  <p className="text-[11px] font-medium text-slate-400">{formatMoney(film.budget, true)} budget</p>
                </div>
              </Link>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function TimeFilter() {
  const [active, setActive] = useState('ALL TIME')
  return (
    <div className="tab-bar">
      {['ALL TIME','5 YRS','3 YRS','1 YR'].map((t) => (
        <button
          key={t}
          onClick={() => setActive(t)}
          className={active === t ? 'tab-item-active' : 'tab-item'}
        >
          {t}
        </button>
      ))}
    </div>
  )
}

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-filmiq-bg">
      <div className="text-center">
        <div className="mb-4 flex items-center justify-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy">
            <Film className="h-5 w-5 text-white" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-navy">FilmIQ</span>
        </div>
        <div className="mx-auto h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-2/3 animate-pulse rounded-full bg-brand" />
        </div>
        <p className="mt-3 text-[11px] uppercase tracking-widest text-slate-400">Loading Dashboard…</p>
      </div>
    </div>
  )
}
