'use client'

import { useEffect, useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { analytics } from '@/lib/api'
import type { TrendData } from '@/lib/api'
import { CHART_COLORS } from '@/lib/utils'

export default function TrendsPage() {
  const [data,    setData]    = useState<TrendData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    analytics.trends().then(setData).catch(console.error).finally(() => setLoading(false))
  }, [])

  if (loading || !data) {
    return <div className="flex min-h-screen items-center justify-center text-navy">Loading Trend Explorer…</div>
  }

  const decadeRows = Object.entries(data.genre_by_decade)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([decade, genreMap]) => ({ decade, ...genreMap }))

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">Historical Patterns</p>
        <h1 className="text-4xl font-bold text-navy">Trend Explorer</h1>
        <p className="mt-1 text-sm text-slate-400">Genre, rating, and production patterns across the full dataset</p>
      </div>

      <div className="mb-5">
        <ChartCard title="Popular Genres by Decade" subtitle="Average popularity score for the catalog's top 6 genres" badge="By Decade" badgeColor="purple">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={decadeRows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="decade" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
              {data.top_genres.map((g, i) => (
                <Bar key={g} dataKey={g} name={g} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ChartCard title="Rating Trend Over Time" subtitle="Average vote_average by release year" badge="Quality" badgeColor="blue">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.rating_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Line type="monotone" dataKey="avg_rating" name="Avg Rating" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Popularity Trend Over Time" subtitle="Average TMDb popularity by release year" badge="Buzz" badgeColor="gold">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.popularity_trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Line type="monotone" dataKey="avg_popularity" name="Avg Popularity" stroke="#d4a843" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-5">
        <ChartCard title="Movie Production Growth" subtitle="Films released per year" badge="Volume" badgeColor="green">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.production_growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Bar dataKey="count" name="Films Released" fill="#10b981" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
