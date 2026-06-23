'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { analytics } from '@/lib/api'
import type { GenreStat } from '@/lib/api'
import { formatMoney, CHART_COLORS } from '@/lib/utils'

export default function GenresPage() {
  const [genres,   setGenres]   = useState<GenreStat[]>([])
  const [active,   setActive]   = useState<string | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    analytics.genreAnalytics()
      .then((g) => { setGenres(g); setActive(g[0]?.genre ?? null) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-navy">Loading Genre Analytics…</div>
  }

  const selected = genres.find((g) => g.genre === active) ?? genres[0]

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">Catalog Breakdown</p>
        <h1 className="text-4xl font-bold text-navy">Genre Analytics</h1>
        <p className="mt-1 text-sm text-slate-400">Popularity, ratings, and growth across {genres.length} genres</p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Genre Popularity Ranking" subtitle="Average TMDb popularity score" badge="Live Data" badgeColor="green">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={genres.slice(0, 12)} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="genre" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
              <Tooltip content={<GoldTooltip />} />
              <Bar dataKey="avg_popularity" name="Avg Popularity" radius={[0, 4, 4, 0]} onClick={(d: GenreStat) => setActive(d.genre)}>
                {genres.slice(0, 12).map((g, i) => (
                  <Cell key={i} fill={g.genre === active ? '#d4a843' : CHART_COLORS[i % CHART_COLORS.length]} cursor="pointer" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Average Rating by Genre" subtitle="Mean TMDb vote average" badge="0–10 scale" badgeColor="blue">
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={[...genres].sort((a, b) => b.avg_rating - a.avg_rating).slice(0, 12)} layout="vertical" margin={{ left: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis type="category" dataKey="genre" tick={{ fill: '#64748b', fontSize: 11 }} width={100} />
              <Tooltip content={<GoldTooltip />} />
              <Bar dataKey="avg_rating" name="Avg Rating" radius={[0, 4, 4, 0]} fill="#2563eb" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <ChartCard title="Movies per Genre" subtitle="Total film count" className="lg:col-span-1">
          <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {[...genres].sort((a, b) => b.count - a.count).map((g) => (
              <button
                key={g.genre}
                onClick={() => setActive(g.genre)}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  g.genre === active ? 'bg-brand-50 text-brand font-semibold' : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{g.genre}</span>
                <span className="font-mono text-xs text-slate-400">{g.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        </ChartCard>

        <div className="lg:col-span-2">
          <ChartCard
            title={`${selected?.genre ?? ''} — Growth Over Time`}
            subtitle="Films released per year"
            badge="Selected Genre"
            badgeColor="purple"
          >
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={selected?.growth ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <Tooltip content={<GoldTooltip />} />
                <Line type="monotone" dataKey="count" name="Films" stroke="#d4a843" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Top-Performing Movie per Genre" subtitle="Ranked by revenue (popularity when revenue data is missing)">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {genres.filter((g) => g.top_movie).map((g) => (
            <Link
              key={g.genre}
              href={`/movies/${g.top_movie!.id}`}
              className="rounded-lg border border-slate-200 p-4 transition-colors hover:border-brand hover:bg-brand-50"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[2px] text-slate-400">{g.genre}</p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-800">{g.top_movie!.title}</p>
              <p className="mt-0.5 text-xs font-medium text-brand">{formatMoney(g.top_movie!.revenue, true)}</p>
            </Link>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
