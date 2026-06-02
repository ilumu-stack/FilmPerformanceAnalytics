'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import { ChartCard } from '@/components/ui/Cards'
import { GoldTooltip } from '@/components/ui/GoldTooltip'
import { investors } from '@/lib/api'
import { formatMoney } from '@/lib/utils'

export default function InvestorPage() {
  const [riskMatrix,     setRiskMatrix]     = useState<any[]>([])
  const [opportunities,  setOpportunities]  = useState<any[]>([])
  const [topRoi,         setTopRoi]         = useState<any[]>([])
  const [africaOutlook,  setAfricaOutlook]  = useState<any>(null)
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
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
    }).catch(console.error)
    .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-display text-2xl tracking-widest text-yellow-400">LOADING...</div>
      </div>
    )
  }

  const SIGNAL_STYLES: Record<string, string> = {
    'STRONG BUY': 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    'BUY':        'border-emerald-500/15 bg-emerald-500/5 text-emerald-300',
    'ACCUMULATE': 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    'WATCH':      'border-cyan-500/20 bg-cyan-500/5 text-cyan-400',
    'CAUTION':    'border-red-500/20 bg-red-500/5 text-red-400',
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Investment Intelligence</p>
          <h1 className="font-display text-5xl tracking-widest">INVESTOR INTEL</h1>
          <p className="mt-1 text-sm text-gray-500">ROI analysis, risk matrix, and African market opportunities</p>
        </div>
        <span className="badge-gold px-4 py-2 text-sm">EXECUTIVE VIEW</span>
      </div>

      {/* ROI KPIs */}
      <div className="mb-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Adventure AVG ROI', val: '+812%', color: 'text-emerald-400', sub: 'Highest genre' },
          { label: 'Animation AVG ROI', val: '+643%', color: 'text-yellow-400',  sub: 'Family anchor' },
          { label: 'Action AVG ROI',    val: '+521%', color: 'text-cyan-400',    sub: 'Stable high' },
          { label: 'Thriller AVG ROI',  val: '−12%',  color: 'text-red-400',     sub: 'High risk' },
        ].map(({ label, val, color, sub }) => (
          <div key={label} className="glass-card p-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">{label}</div>
            <div className={`font-display text-3xl tracking-wide ${color}`}>{val}</div>
            <div className="mt-1 text-xs text-gray-500">{sub}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-5 gap-4">
        {/* Risk Matrix */}
        <div className="col-span-2">
          <ChartCard title="RISK VS RETURN" subtitle="Genre investment matrix" badge="BUBBLE" badgeColor="gold">
            <ResponsiveContainer width="100%" height={280}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis type="number" dataKey="risk"  name="Risk %"  tick={{ fill: '#8892a4', fontSize: 10 }} label={{ value: 'Risk Level (%)', fill: '#8892a4', fontSize: 10, position: 'insideBottom' }} />
                <YAxis type="number" dataKey="roi"   name="ROI %"   tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
                <ZAxis type="number" dataKey="film_count" range={[40, 200]} />
                <Tooltip content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload
                  return (
                    <div className="rounded-lg border border-white/10 bg-filmiq-bg2 px-3 py-2 text-xs">
                      <p className="font-semibold text-white">{d.genre}</p>
                      <p className="text-yellow-400">ROI: +{d.roi}%</p>
                      <p className="text-gray-400">Risk: {d.risk}%</p>
                      <p className="text-gray-400">{d.film_count} films</p>
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
                  <tr className="border-b border-white/[0.07]">
                    {['Film','Budget','Revenue','ROI','Risk'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-[2px] text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {topRoi.map((m) => (
                    <tr key={m.title} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                      <td className="max-w-[160px] truncate px-3 py-3 font-medium text-sm">{m.title}</td>
                      <td className="px-3 py-3 font-mono text-xs text-gray-500">{formatMoney(m.budget, true)}</td>
                      <td className="px-3 py-3 font-mono text-xs text-yellow-400">{formatMoney(m.revenue, true)}</td>
                      <td className="px-3 py-3 font-mono text-sm font-semibold text-emerald-400">+{m.roi?.toFixed(0)}%</td>
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
        {/* Africa Market Growth */}
        <ChartCard title="AFRICAN MARKET OUTLOOK" subtitle="Projected value 2022–2030 ($M)" badge="18% CAGR" badgeColor="gold">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={africaOutlook?.year_projections ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="year" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
              <Tooltip content={<GoldTooltip formatter={(v) => `$${v}M`} />} />
              <Line type="monotone" dataKey="value" stroke="#d4a843" strokeWidth={2} dot={{ r: 3, fill: '#d4a843' }} name="Market ($M)" />
            </LineChart>
          </ResponsiveContainer>
          <p className="mt-3 text-xs leading-relaxed text-gray-500">
            African film market projected to grow from <span className="text-yellow-400">$640M (2024)</span> to{' '}
            <span className="text-yellow-400">$2.1B by 2030</span> at 18% CAGR. Uganda leads East Africa.
          </p>
        </ChartCard>

        {/* Streaming vs Cinema */}
        <ChartCard title="STREAMING VS CINEMA" subtitle="Revenue channel comparison ($B)">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={africaOutlook?.streaming_vs_cinema ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="year" tick={{ fill: '#8892a4', fontSize: 10 }} />
              <YAxis tick={{ fill: '#8892a4', fontSize: 10 }} />
              <Tooltip content={<GoldTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#8892a4', fontSize: 11 }}>{v}</span>} />
              <Line type="monotone" dataKey="cinema"    stroke="#d4a843" strokeWidth={2} dot={false} name="Cinema" />
              <Line type="monotone" dataKey="streaming" stroke="#38d9f5" strokeWidth={2} dot={false} name="Streaming" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Opportunities */}
        <ChartCard title="AI INVESTMENT SIGNALS" subtitle="Claude-scored opportunities" badge="LIVE" badgeColor="green">
          <div className="space-y-3 mt-1">
            {opportunities.map((o) => (
              <div key={o.genre} className={`rounded-lg border p-3 ${SIGNAL_STYLES[o.signal] || 'border-white/10 bg-white/[0.02] text-gray-400'}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide">{o.signal}</span>
                  <span className="font-mono text-[11px] text-gray-400">{o.expected_roi}</span>
                </div>
                <div className="text-[13px] font-semibold text-white">{o.genre}</div>
                <div className="mt-0.5 text-[11px] text-gray-400 leading-relaxed">{o.rationale}</div>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
