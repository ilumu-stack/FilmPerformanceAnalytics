'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Film, Globe, Calendar, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartCard, KpiCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { MoviePoster } from '@/components/ui/MoviePoster'
import { analytics } from '@/lib/api'
import type { OverviewData } from '@/lib/api'
import { formatMoney } from '@/lib/utils'

export default function ExecutiveOverviewPage() {
  const [data,    setData]    = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analytics.overview().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-navy">Loading Executive Overview…</div>
  }

  const { coverage, top_genres, top_movies, most_active_years, insights, trending } = data

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">Executive Summary</p>
        <h1 className="text-4xl font-bold text-navy">Dataset Overview</h1>
        <p className="mt-1 text-sm text-slate-400">A high-level summary of the full FilmIQ catalog</p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Total Movies" value={coverage.total_movies.toLocaleString()} color="#2563eb" icon={Film} />
        <KpiCard label="Year Range" value={coverage.year_range ? `${coverage.year_range[0]}–${coverage.year_range[1]}` : '—'} color="#8b5cf6" icon={Calendar} />
        <KpiCard label="Financial Coverage" value={`${coverage.financial_coverage_pct}%`} change="have budget + revenue data" color="#10b981" icon={TrendingUp} />
        <KpiCard label="Languages" value={String(coverage.language_count)} color="#f59e0b" icon={Globe} />
      </div>

      <div className="mb-6 card p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand" />
          <h3 className="text-[15px] font-semibold text-navy">Key Insights</h3>
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

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Top Genres" subtitle="By film count" badge="Top 5" badgeColor="purple">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={top_genres} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="genre" tick={{ fill: '#64748b', fontSize: 11 }} width={96} />
              <Tooltip content={<GoldTooltip />} />
              <Bar dataKey="count" name="Films" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Most Active Years" subtitle="Highest film production volume" badge="Top 5" badgeColor="green">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={most_active_years}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Bar dataKey="count" name="Films" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-5">
        <ChartCard title="Top Movies" subtitle="Highest revenue in the catalog" badge="Top 5" badgeColor="blue">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {top_movies.map((m) => (
              <Link key={m.id} href={`/movies/${m.id}`} className="group">
                <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand">{m.title}</p>
                <p className="text-xs font-medium text-brand">{formatMoney(m.revenue, true)}</p>
              </Link>
            ))}
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Trending Content" subtitle="Highest popularity among recent releases" badge="Live" badgeColor="gold">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
          {trending.map((m) => (
            <Link key={m.id} href={`/movies/${m.id}`} className="group">
              <MoviePoster src={m.poster_url} title={m.title} className="aspect-[2/3] w-full shadow-card transition-transform group-hover:-translate-y-1" />
              <p className="mt-2 truncate text-xs font-semibold text-slate-800 group-hover:text-brand">{m.title}</p>
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
