'use client'

import { useEffect, useState } from 'react'
import { ChartCard } from '@/components/ui/Cards'
import { analytics } from '@/lib/api'
import type { PersonStat } from '@/lib/api'
import { formatMoney } from '@/lib/utils'

export default function PeoplePage() {
  const [directors, setDirectors] = useState<PersonStat[]>([])
  const [actors,    setActors]    = useState<PersonStat[]>([])
  const [tab,       setTab]       = useState<'directors' | 'actors'>('directors')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    analytics.people(20)
      .then((p) => { setDirectors(p.top_directors); setActors(p.top_actors) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-navy">Loading People Analytics…</div>
  }

  const list = tab === 'directors' ? directors : actors

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Talent Intelligence</p>
          <h1 className="text-4xl font-bold text-navy">Actor &amp; Director Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">
            Most productive talent, average ratings, and genre specialization — derived from each person&rsquo;s filmography in the dataset
          </p>
        </div>
        <div className="tab-bar">
          <button onClick={() => setTab('directors')} className={tab === 'directors' ? 'tab-item-active' : 'tab-item'}>Directors</button>
          <button onClick={() => setTab('actors')} className={tab === 'actors' ? 'tab-item-active' : 'tab-item'}>Actors</button>
        </div>
      </div>

      <ChartCard
        title={tab === 'directors' ? 'Most Productive Directors' : 'Most Productive Actors'}
        subtitle={tab === 'directors' ? 'Ranked by total box office revenue' : 'Ranked by number of film appearances'}
        badge={`Top ${list.length}`}
        badgeColor="blue"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {['#', 'Name', 'Films', 'Avg Rating', tab === 'directors' ? 'Total Revenue' : '', 'Top Genre'].filter(Boolean).map((h, i) => (
                  <th key={i} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.name} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{String(i + 1).padStart(2, '0')}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-500">{p.film_count}</td>
                  <td className="px-4 py-3 font-mono text-sm">
                    <span className="mr-1 text-amber-400">★</span>
                    <span className="text-slate-600">{p.avg_rating.toFixed(1)}</span>
                  </td>
                  {tab === 'directors' && (
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-brand">{formatMoney(p.total_revenue ?? 0, true)}</td>
                  )}
                  <td className="px-4 py-3">
                    {p.top_genre && <span className="badge-blue">{p.top_genre}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <p className="mt-4 text-xs text-slate-400">
        Actor stats are limited to the names listed in each film&rsquo;s cast field (no character/role data is available in the
        dataset). Filtered to people with 2+ film appearances to avoid one-off noise.
      </p>
    </div>
  )
}
