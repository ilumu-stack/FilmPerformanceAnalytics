'use client'

import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ChevronRight, Send } from 'lucide-react'
import { predictions as predictAPI, chat as chatAPI, analytics } from '@/lib/api'
import { formatMoney, formatROI, riskBadgeClass } from '@/lib/utils'
import type { PredictionResult, GenreStat } from '@/lib/api'
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

// Real coefficients from ml/predictor.py's analytical formula — only the four
// terms actually used in _analytical_predict() are listed. (The previous
// version also listed "First-day Box Office", "Intended Audience", and "Heat /
// Search Index" rows with invented coefficients that don't correspond to any
// term in that formula — those request fields exist but aren't weighted there.)
const PREDICTOR_COEFFICIENTS = [
  { label: 'Negative Comments', value: -2.369,  color: 'text-red-400'     },
  { label: 'Positive Comments', value:  1.862,  color: 'text-emerald-400' },
  { label: 'Actors Score',      value:  1.2157, color: 'text-brand'       },
  { label: 'Director Score',    value:  1.02198, color: 'text-purple-400' },
]
const MAX_ABS_COEFFICIENT = Math.max(...PREDICTOR_COEFFICIENTS.map((c) => Math.abs(c.value)))
const FEATURE_ROWS = PREDICTOR_COEFFICIENTS.map((c) => ({
  label: c.label,
  val:   `${c.value >= 0 ? '+' : ''}${c.value.toFixed(3)}`,
  color: c.color,
  pct:   Math.round((Math.abs(c.value) / MAX_ABS_COEFFICIENT) * 100),
}))

const INITIAL_MESSAGES: Message[] = [
  {
    role:    'assistant',
    content: "Welcome to FilmIQ Analyst. Ask me about box office trends, Ugandan market insights, genre performance, or investment opportunities.",
  },
]

export default function PredictPage() {
  const searchParams = useSearchParams()

  const [form, setForm] = useState({
    title:          '',
    budget:         5_000_000,
    genre:          'Action',
    director_score: 0.7,
    cast_score:     0.65,
    season:         'summer',
    market:         'pan_african',
    logline:        '',
    comments:       '',
  })
  const [movieId,     setMovieId]     = useState<string | undefined>(undefined)
  const [result,      setResult]      = useState<PredictionResult | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [messages,    setMessages]    = useState<Message[]>(INITIAL_MESSAGES)
  const [chatInput,   setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [realFacts,   setRealFacts]   = useState<{ genres: GenreStat[]; bestModel: string | null; bestR2: number | null }>({
    genres: [], bestModel: null, bestR2: null,
  })
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Prefill from a filmmaker's "Run Prediction for this Movie" link
  useEffect(() => {
    const movie_id = searchParams.get('movie_id')
    const title     = searchParams.get('title')
    const genre     = searchParams.get('genre')
    const budget    = searchParams.get('budget')
    if (movie_id) setMovieId(movie_id)
    setForm((f) => ({
      ...f,
      ...(title  ? { title } : {}),
      ...(genre  ? { genre } : {}),
      ...(budget ? { budget: Number(budget) } : {}),
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real facts for the chat fallback — fetched once, never hardcoded
  useEffect(() => {
    Promise.all([analytics.genreAnalytics(), analytics.modelAccuracy()])
      .then(([genres, acc]) => setRealFacts({ genres, bestModel: acc.best_model, bestR2: acc.best_r2 }))
      .catch(() => {})
  }, [])

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
      const { comments, ...rest } = form
      const review_comments = comments
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text }))
      const res = await predictAPI.predict({
        ...rest,
        ...(review_comments.length ? { review_comments } : {}),
        ...(movieId ? { movie_id: movieId } : {}),
      })
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

  // Every figure here comes from realFacts (fetched from /api/analytics/* —
  // real, computed dataset numbers), never a hardcoded claim. There is no
  // Ugandan-market dataset in this product, so we say so rather than invent one.
  function getFallbackResponse(q: string): string {
    const lower = q.toLowerCase()
    const topGenres = [...realFacts.genres].sort((a, b) => b.avg_revenue - a.avg_revenue).slice(0, 3)
    const genreLine = topGenres.length
      ? topGenres.map((g) => `${g.genre} ($${(g.avg_revenue / 1e6).toFixed(0)}M avg)`).join(', ')
      : 'genre data is still loading'

    if (lower.includes('africa') || lower.includes('uganda'))
      return `This dataset has no Ugandan-market sizing or CAGR data, so I can't give a real figure for that. From the films we do have: ${genreLine}.`
    if (lower.includes('genre') || lower.includes('roi') || lower.includes('invest'))
      return `Highest-revenue genres in the dataset: ${genreLine}.`
    if (realFacts.bestModel)
      return `FilmIQ's ${realFacts.bestModel} model achieves R²=${realFacts.bestR2}% on this dataset's box-office regression task.`
    return `Highest-revenue genres in the dataset: ${genreLine}.`
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8">
        <p className="section-label mb-1">AI Engine</p>
        <h1 className="text-4xl font-bold text-navy">Prediction Studio</h1>
        <p className="mt-1 text-sm text-slate-400">
          CNN-C Model{realFacts.bestR2 != null ? ` · ${realFacts.bestR2}% Accuracy (R²)` : ''} · Powered by Claude AI
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* ── Prediction Form ─────────────────────────────────────────────── */}
        <div className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            <h2 className="text-lg font-semibold text-navy">Box Office Predictor</h2>
            <span className="ml-auto badge-green font-mono">CNN-C v1.0</span>
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
                  className="w-full cursor-pointer accent-brand"
                />
              </Field>
              <Field label={`Cast Score: ${form.cast_score.toFixed(1)}`}>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={form.cast_score}
                  onChange={handleRange('cast_score')}
                  className="w-full cursor-pointer accent-brand"
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

            <Field label="Audience Comments (optional — one per line)">
              <textarea
                className="input-field"
                rows={3}
                placeholder={'Scored by the real sentiment pipeline and fed into the prediction.\ne.g. "Amazing trailer, can\'t wait!"'}
                value={form.comments}
                onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
              />
            </Field>

            {movieId && (
              <p className="text-[11px] text-slate-400">
                Linked to your filmmaker movie — this prediction will appear in its analytics.
              </p>
            )}

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
                className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">
                    Prediction Results
                  </span>
                  <span className={riskBadgeClass(result.risk_level)}>
                    {result.risk_level} RISK
                  </span>
                </div>
                <ResultRow label="Predicted Revenue"  value={formatMoney(result.predicted_revenue, true)}          color="text-brand font-bold" />
                <ResultRow label="Opening Weekend"    value={formatMoney(result.predicted_opening_weekend, true)}  color="text-purple-600" />
                <ResultRow
                  label="Estimated ROI"
                  value={formatROI(result.predicted_roi)}
                  color={result.predicted_roi > 0 ? 'text-emerald-600' : 'text-red-600'}
                />
                <ResultRow label="Genre Multiplier"  value={`${result.genre_multiplier.toFixed(2)}x`}              color="text-purple-400" />
                <ResultRow label="Model Confidence"  value={`${((result.confidence ?? 0.837) * 100).toFixed(1)}%`} />
                {result.sentiment_analysis && (
                  <ResultRow
                    label="Audience Sentiment"
                    value={`${result.sentiment_analysis.sentiment_label} (${result.sentiment_analysis.positive_count}+ / ${result.sentiment_analysis.negative_count}− of ${result.sentiment_analysis.total_comments})`}
                    color={
                      result.sentiment_analysis.sentiment_label === 'positive' ? 'text-emerald-600'
                      : result.sentiment_analysis.sentiment_label === 'negative' ? 'text-red-600'
                      : undefined
                    }
                  />
                )}
                {result.ai_analysis && (
                  <div className="mt-3 border-t border-slate-200 pt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">
                      AI Analysis
                    </p>
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600">
                      {result.ai_analysis}
                    </p>
                  </div>
                )}
                <div className="mt-3 flex items-start gap-2 border-t border-slate-200 pt-3">
                  <ChevronRight size={14} className="mt-0.5 shrink-0 text-brand" />
                  <p className="text-xs text-slate-400">{result.recommendation}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Right Column: Chat + Feature Importance ──────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Chat */}
          <div
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card"
            style={{ maxHeight: 420 }}
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <div>
                <div className="font-semibold text-navy">FilmIQ Analyst</div>
                <div className="text-[10px] text-slate-400">AI-powered film intelligence</div>
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
                        ? 'border border-brand-200 bg-brand-50 text-navy font-medium'
                        : m.role === 'thinking'
                        ? 'border border-slate-200 bg-slate-50 italic text-slate-400'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 border-t border-slate-200 p-3">
              <input
                className="input-field flex-1 text-xs"
                placeholder="Ask about box office, genres, Ugandan market..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat() }}
              />
              <button
                onClick={sendChat}
                disabled={chatLoading}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white transition hover:bg-brand-dark disabled:opacity-50"
              >
                <Send size={14} />
              </button>
            </div>
          </div>

          {/* Feature importance */}
          <div className="card p-5">
            <h3 className="mb-1 text-base font-semibold text-navy">Feature Importance</h3>
            <p className="mb-4 text-[11px] text-slate-400">
              MLR regression coefficients — Zhang et al. (2024) Table 6
            </p>
            <div className="space-y-3">
              {FEATURE_ROWS.map((f) => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-500">{f.label}</span>
                    <span className={`font-mono font-medium ${f.color}`}>{f.val}</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-200">
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
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">
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
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`font-mono text-sm font-medium ${color ?? 'text-slate-800'}`}>{value}</span>
    </div>
  )
}
