'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ChevronRight, Send } from 'lucide-react'
import { predictions as predictAPI, chat as chatAPI } from '@/lib/api'
import { formatMoney, formatROI, riskBadgeClass } from '@/lib/utils'
import type { PredictionResult } from '@/lib/api'
import toast from 'react-hot-toast'

interface Message {
  role:    'user' | 'assistant' | 'thinking'
  content: string
}

const GENRES  = ['Action','Adventure','Animation','Comedy','Crime','Drama','Family','Fantasy','Horror','Romance','Science Fiction','Thriller']
const SEASONS = [
  { v: 'summer',          l: 'Summer (Jun–Aug)'  },
  { v: 'winter_vacation', l: 'Holiday (Nov–Dec)' },
  { v: 'easter',          l: 'Easter (Mar–Apr)'  },
  { v: 'general',         l: 'General Release'   },
]
const MARKETS = [
  { v: 'uganda_only',  l: 'Uganda Only'   },
  { v: 'east_africa',  l: 'East Africa'   },
  { v: 'pan_african',  l: 'Pan-African'   },
  { v: 'global',       l: 'Global'        },
]

const FEATURE_ROWS = [
  { label: 'Positive Comments',   val: '+1.862', color: 'text-emerald-400', pct: 90  },
  { label: 'First-day Box Office', val: '+1.222', color: 'text-yellow-400',  pct: 100 },
  { label: 'Actors Score',         val: '+1.216', color: 'text-cyan-400',    pct: 80  },
  { label: 'Intended Audience',    val: '+0.962', color: 'text-cyan-400',    pct: 65  },
  { label: 'Heat / Search Index',  val: '+0.861', color: 'text-purple-400',  pct: 58  },
  { label: 'Negative Comments',    val: '−2.369', color: 'text-red-400',     pct: 95  },
]

const INITIAL_MESSAGES: Message[] = [
  {
    role:    'assistant',
    content: "Welcome to FilmIQ Analyst. Ask me about box office trends, African market insights, genre performance, or investment opportunities.",
  },
]

export default function PredictPage() {
  const [form, setForm] = useState({
    title:          '',
    budget:         5_000_000,
    genre:          'Action',
    director_score: 0.7,
    cast_score:     0.65,
    season:         'summer',
    market:         'pan_african',
    logline:        '',
  })
  const [result,      setResult]      = useState<PredictionResult | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [messages,    setMessages]    = useState<Message[]>(INITIAL_MESSAGES)
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Generic setter for text/select fields
  const handleChange =
    (key: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value
      setForm((f) => ({ ...f, [key]: val }))
    }

  // Range slider setter
  const handleRange =
    (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: Number(e.target.value) }))

  // ── Prediction ────────────────────────────────────────────────────────────
  async function runPrediction() {
    if (loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await predictAPI.predict(form)
      setResult(res)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Prediction failed'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Chat — proxied through backend to keep Anthropic key server-side ─────
  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')

    const nextMessages: Message[] = [
      ...messages,
      { role: 'user',     content: text },
      { role: 'thinking', content: 'Analyzing...' },
    ]
    setMessages(nextMessages)
    setChatLoading(true)

    try {
      const data = await chatAPI.send(
        text,
        messages
          .filter((m) => m.role !== 'thinking')
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      )
      const reply = data.reply ?? getFallbackResponse(text)
      setMessages((m) => [...m.slice(0, -1), { role: 'assistant', content: reply }])
    } catch {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'assistant', content: getFallbackResponse(text) },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  function getFallbackResponse(q: string): string {
    const lower = q.toLowerCase()
    if (lower.includes('africa') || lower.includes('uganda'))
      return 'The African film market grows at 18% CAGR, projected to reach $2.1B by 2030. Uganda leads East Africa with 3 major multiplex operators. Pan-African content targeting all 54 nations offers the best scale.'
    if (lower.includes('genre'))
      return 'From 9,999 films: Adventure leads at $226M avg revenue, Family $195M, Sci-Fi $183M. Thriller underperforms (MLR coeff −1.12). Comedy and Romance offer low-risk, moderate-return profiles.'
    if (lower.includes('roi') || lower.includes('invest'))
      return 'Highest ROI: Ne Zha 2 (+2,554%), Avatar (+1,134%), Titanic (+1,032%). Pattern: family/animation content + strategic summer release + pan-African distribution maximizes returns.'
    return 'FilmIQ has analyzed 9,999 TMDB films. CNN-C model achieves 83.7% accuracy. Key finding: adding comment sentiment data improves box office prediction by 11.8–16.1% (Zhang et al., 2024).'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">AI Engine</p>
        <h1 className="font-display text-5xl tracking-widest">PREDICTION STUDIO</h1>
        <p className="mt-1 text-sm text-gray-500">
          CNN-C Model · 83.7% Accuracy · Powered by Claude AI
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Prediction Form ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[0.03] to-cyan-400/[0.02] p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <h2 className="font-display text-xl tracking-wide">BOX OFFICE PREDICTOR</h2>
            <span className="ml-auto rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400">
              CNN-C v1.0
            </span>
          </div>

          <div className="space-y-4">
            <Field label="Movie Title">
              <input
                className="input-field"
                placeholder="e.g. The Last King of Uganda"
                value={form.title}
                onChange={handleChange('title')}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Budget (USD)">
                <input
                  className="input-field"
                  type="number"
                  min={0}
                  value={form.budget}
                  onChange={handleChange('budget')}
                />
              </Field>
              <Field label="Primary Genre">
                <select
                  className="input-field"
                  value={form.genre}
                  onChange={handleChange('genre')}
                >
                  {GENRES.map((g) => (
                    <option key={g} className="bg-filmiq-bg3">{g}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Director Score: ${form.director_score.toFixed(1)}`}>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={form.director_score}
                  onChange={handleRange('director_score')}
                  className="w-full cursor-pointer accent-yellow-400"
                />
              </Field>
              <Field label={`Cast Score: ${form.cast_score.toFixed(1)}`}>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={form.cast_score}
                  onChange={handleRange('cast_score')}
                  className="w-full cursor-pointer accent-yellow-400"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Release Season">
                <select className="input-field" value={form.season} onChange={handleChange('season')}>
                  {SEASONS.map(({ v, l }) => (
                    <option key={v} value={v} className="bg-filmiq-bg3">{l}</option>
                  ))}
                </select>
              </Field>
              <Field label="Target Market">
                <select className="input-field" value={form.market} onChange={handleChange('market')}>
                  {MARKETS.map(({ v, l }) => (
                    <option key={v} value={v} className="bg-filmiq-bg3">{l}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Logline / Concept">
              <input
                className="input-field"
                placeholder="Brief concept for AI analysis..."
                value={form.logline}
                onChange={handleChange('logline')}
              />
            </Field>

            <button
              onClick={runPrediction}
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Cpu size={14} className="animate-spin" />
                  ANALYZING...
                </span>
              ) : (
                '▶ GENERATE AI PREDICTION'
              )}
            </button>
          </div>

          {/* Result */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-5 overflow-hidden rounded-lg border border-white/[0.06] bg-black/30 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
                    Prediction Results
                  </span>
                  <span className={riskBadgeClass(result.risk_level)}>
                    {result.risk_level} RISK
                  </span>
                </div>
                <ResultRow label="Predicted Revenue"  value={formatMoney(result.predicted_revenue, true)}          color="text-yellow-400" />
                <ResultRow label="Opening Weekend"    value={formatMoney(result.predicted_opening_weekend, true)}  color="text-cyan-400" />
                <ResultRow
                  label="Estimated ROI"
                  value={formatROI(result.predicted_roi)}
                  color={result.predicted_roi > 0 ? 'text-emerald-400' : 'text-red-400'}
                />
                <ResultRow label="Genre Multiplier"  value={`${result.genre_multiplier.toFixed(2)}x`}              color="text-purple-400" />
                <ResultRow label="Model Confidence"  value={`${((result.confidence ?? 0.837) * 100).toFixed(1)}%`} />
                {result.ai_analysis && (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
                      AI Analysis
                    </p>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-300">
                      {result.ai_analysis}
                    </p>
                  </div>
                )}
                <div className="mt-3 flex items-start gap-2 border-t border-white/[0.06] pt-3">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-yellow-400" />
                  <p className="text-xs text-gray-400">{result.recommendation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right Column: Chat + Feature Importance ──────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Chat */}
          <div
            className="flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]"
            style={{ maxHeight: 420 }}
          >
            <div className="flex items-center gap-3 border-b border-white/[0.07] px-5 py-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <div>
                <div className="font-display text-base tracking-wide">FILMIQ ANALYST</div>
                <div className="text-[10px] text-gray-500">AI-powered film intelligence</div>
              </div>
            </div>

            <div
              className="flex-1 space-y-3 overflow-y-auto p-4"
              style={{ scrollbarWidth: 'thin' }}
            >
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                      m.role === 'user'
                        ? 'border border-yellow-400/20 bg-yellow-400/10 text-yellow-100'
                        : m.role === 'thinking'
                        ? 'border border-white/[0.07] bg-white/[0.02] italic text-gray-500'
                        : 'border border-white/[0.07] bg-white/[0.02] text-gray-200'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 border-t border-white/[0.07] p-3">
              <input
                className="input-field flex-1 text-xs"
                placeholder="Ask about box office, genres, African market..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-yellow-400 text-black transition hover:bg-yellow-300 disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Feature importance */}
          <div className="glass-card p-5">
            <h3 className="mb-1 font-display text-base tracking-wide">FEATURE IMPORTANCE</h3>
            <p className="mb-4 text-[11px] text-gray-500">
              MLR regression coefficients — Zhang et al. (2024) Table 6
            </p>
            <div className="space-y-3">
              {FEATURE_ROWS.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-gray-400">{f.label}</span>
                    <span className={`font-mono font-medium ${f.color}`}>{f.val}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full opacity-70"
                      style={{
                        width: `${f.pct}%`,
                        background:
                          f.color.includes('red')     ? '#f05068' :
                          f.color.includes('emerald') ? '#22d49a' :
                          f.color.includes('cyan')    ? '#38d9f5' :
                          f.color.includes('yellow')  ? '#d4a843' : '#9d6ef8',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
        {label}
      </label>
      {children}
    </div>
  )
}

function ResultRow({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-mono text-sm font-medium ${color ?? 'text-white'}`}>{value}</span>
    </div>
  )
}
