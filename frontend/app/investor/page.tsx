'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { investors } from '@/lib/api'
import { formatMoney } from '@/lib/utils'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'

export default function InvestorPage() {
  const router = useRouter()
  const { isAuthed } = useAuthStore()

  const [riskMatrix,     setRiskMatrix]     = useState<any[]>([])
  const [opportunities,  setOpportunities]  = useState<any[]>([])
  const [topRoi,         setTopRoi]         = useState<any[]>([])
  const [africaOutlook,  setAfricaOutlook]  = useState<any>(null)
  const [loading,       setLoading]       = useState(true)

  // ── Auth guard — /api/investors/* requires the investor or admin role ──────
  useEffect(() => {
    const hydrated = useAuthStore.getState()._hydrated
    const check = (state: ReturnType<typeof useAuthStore.getState>) => {
      if (!state.isAuthed) { router.replace('/auth/login'); return }
      if (!['investor', 'admin'].includes(state.user?.role ?? '')) {
        router.replace('/dashboard')
      }
    }
    if (!hydrated) {
      const unsub = useAuthStore.subscribe((state) => {
        if (state._hydrated) { unsub(); check(state) }
      })
      return unsub
    }
    check(useAuthStore.getState())
  }, [router])

  useEffect(() => {
    if (!isAuthed) return
    Promise.all([
      investors.roiMatrix(),
      investors.opportunities(),
      investors.topRoi(8),
      investors.africaOutlook(),
    ]).then(([rm, op, tr, ao]) => {
      setRiskMatrix(rm)
      setOpportunities(op)
      setTopRoi(tr)
      setAfricaOutlook(ao)
    }).catch((err) => toast.error(err?.message ?? 'Failed to load investor data'))
    .finally(() => setLoading(false))
  }, [isAuthed])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl font-bold text-navy">Loading Investor Intelligence…</div>
      </div>
    )
  }

  const SIGNAL_STYLES: Record<string, string> = {
    'STRONG BUY': 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'BUY':        'border-emerald-200 bg-emerald-50 text-emerald-600',
    'ACCUMULATE': 'border-amber-200 bg-amber-50 text-amber-700',
    'WATCH':      'border-blue-200 bg-blue-50 text-blue-700',
    'CAUTION':    'border-red-200 bg-red-50 text-red-700',
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Investment Intelligence</p>
          <h1 className="text-4xl font-bold text-navy">Investor Intelligence</h1>
          <p className="mt-1 text-sm text-slate-400">ROI analysis, risk matrix, and African market opportunities</p>
        </div>
        <span className="badge-gold px-4 py-2 text-sm">EXECUTIVE VIEW</span>
      </div>

      {/* ROI KPIs — computed from the real per-genre ROI matrix (top 3 + lowest) */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {(() => {
          const byRoi = [...riskMatrix].sort((a, b) => b.roi - a.roi)
          const picks = byRoi.length > 3 ? [...byRoi.slice(0, 3), byRoi[byRoi.length - 1]] : byRoi
          return picks.map((g) => ({
            label: `${g.genre} AVG ROI`,
            val:   `${g.roi >= 0 ? '+' : ''}${g.roi.toFixed(0)}%`,
            color: g.roi >= 400 ? 'text-emerald-600' : g.roi >= 0 ? 'text-amber-600' : 'text-red-500',
            sub:   `${g.film_count} films`,
          }))
        })().map(({ label, val, color, sub }) => (
          <div key={label} className="glass-card p-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">{label}</div>
            <div className={`text-3xl font-bold tracking-wide ${color}`}>{val}</div>
            <div className="mt-1 text-xs text-slate-400">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-5 gap-4">
        {/* Risk Matrix */}
        <div className="col-span-2">
          <ChartCard title="RISK VS RETURN" subtitle="Genre investment matrix" badge="BUBBLE" badgeColor="gold">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" dataKey="risk"  name="Risk %"  tick={{ fill: '#94a3b8', fontSize: 10 }} label={{ value: 'Risk Level (%)', fill: '#94a3b8', fontSize: 10, position: 'insideBottom' }} />
                <YAxis type="number" dataKey="roi"   name="ROI %"   tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <ZAxis type="number" dataKey="film_count" range={[40, 200]} />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-card">
                      <p className="font-semibold text-slate-800">{d.genre}</p>
                      <p className="text-amber-600">ROI: +{d.roi}%</p>
                      <p className="text-slate-500">Risk: {d.risk}%</p>
                      <p className="text-slate-500">{d.film_count} films</p>
                    </div>
                  )
                }} />
                {riskMatrix.map((d) => (
                  <Scatter
                    key={d.genre}
                    name={d.genre}
                    data={[d]}
                    fill={d.roi > 400 ? '#22d49a' : d.roi > 0 ? '#d4a843' : '#f05068'}
                    opacity={0.8}
                  />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Top ROI Films */}
        <div className="col-span-3">
          <ChartCard title="HIGHEST ROI FILMS" subtitle="Best historical returns from dataset" badge="TOP 8" badgeColor="green">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {['Film','Budget','Revenue','ROI','Risk'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[2px] text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topRoi.map((m) => (
                    <tr key={m.title} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="max-w-[160px] truncate px-3 py-3 font-medium text-sm text-slate-800">{m.title}</td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-500">{formatMoney(m.budget, true)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-amber-600">{formatMoney(m.revenue, true)}</td>
                      <td className="px-3 py-3 font-mono text-sm font-semibold text-emerald-600">+{m.roi?.toFixed(0)}%</td>
                      <td className="px-3 py-3">
                        <span className={`badge-${m.roi > 500 ? 'cyan' : 'gold'} text-[10px]`}>
                          {m.roi > 1000 ? 'LOW' : m.roi > 500 ? 'MOD' : 'HIGH'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ChartCard>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Africa Market Growth — no dataset backs this; explicitly labeled as an estimate */}
        <ChartCard title="AFRICAN MARKET OUTLOOK" subtitle="External industry estimate — not computed from this dataset" badge="ESTIMATE" badgeColor="gold">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={africaOutlook?.year_projections ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip content={<GoldTooltip formatter={(v) => `$${v}M`} />} />
              <Line type="monotone" dataKey="value" stroke="#d4a843" strokeWidth={2} dot={{ r: 3, fill: '#d4a843' }} name="Market ($M)" />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            The FilmIQ dataset has no African-market sizing, CAGR, or country-level data —
            these figures are an illustrative external estimate, not computed analytics.
          </p>
        </ChartCard>

        {/* Streaming vs Cinema */}
        <ChartCard title="STREAMING VS CINEMA" subtitle="Revenue channel comparison ($B)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={africaOutlook?.streaming_vs_cinema ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="year" tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#64748b', fontSize: 11 }}>{v}</span>} />
              <Line type="monotone" dataKey="cinema"    stroke="#d4a843" strokeWidth={2} dot={false} name="Cinema" />
              <Line type="monotone" dataKey="streaming" stroke="#38d9f5" strokeWidth={2} dot={false} name="Streaming" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Opportunities */}
        <ChartCard title="INVESTMENT SIGNALS" subtitle="Computed from per-genre ROI data" badge="LIVE" badgeColor="green">
          <div className="space-y-3 mt-1">
            {opportunities.map((o) => (
              <div key={o.genre} className={`rounded-lg border p-3 ${SIGNAL_STYLES[o.signal] || 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide">{o.signal}</span>
                  <span className="font-mono text-[11px] text-slate-500">{o.expected_roi}</span>
                </div>
                <div className="text-[13px] font-semibold text-slate-800">{o.genre}</div>
                <div className="mt-0.5 text-[11px] text-slate-500 leading-relaxed">{o.rationale}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
