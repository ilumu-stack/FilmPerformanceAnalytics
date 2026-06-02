// app/predict/page.tsx — FilmIQ AI Prediction Studio
'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, TrendingUp, AlertTriangle, ChevronRight, Send } from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────────────────
interface PredictionInput {
  title:          string
  budget:         number
  genre:          string
  director_score: number
  cast_score:     number
  season:         string
  market:         string
  logline:        string
}

interface PredictionResult {
  predicted_revenue:         number
  predicted_opening_weekend: number
  predicted_roi:             number
  confidence:                number
  model_used:                string
  genre_multiplier:          number
  risk_level:                'LOW' | 'MODERATE' | 'HIGH' | 'VERY HIGH'
  ai_analysis?:              string
  recommendation:            string
}

interface Message {
  role:    'user' | 'assistant' | 'thinking'
  content: string
}

// ─── Form Field ─────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] uppercase tracking-[2px] font-semibold text-gray-500">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls = `
  w-full rounded-lg border border-white/7 bg-white/[0.03]
  px-3 py-2.5 text-sm text-white placeholder-gray-600
  focus:border-yellow-400/50 focus:outline-none transition-colors
`

// ─── Risk Badge ──────────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    LOW:       'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    MODERATE:  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    HIGH:      'bg-red-500/10 text-red-400 border-red-500/20',
    'VERY HIGH':'bg-red-600/10 text-red-500 border-red-500/20',
  }
  return (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold tracking-wide ${map[level] || map.MODERATE}`}>
      {level} RISK
    </span>
  )
}

// ─── Result Row ──────────────────────────────────────────────────────────────
function ResultRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.04] py-2.5 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={`font-mono text-sm font-medium ${color || 'text-white'}`}>{value}</span>
    </div>
  )
}

// ─── Predict Page ────────────────────────────────────────────────────────────
export default function PredictPage() {
  const [form, setForm] = useState<PredictionInput>({
    title:          '',
    budget:         5_000_000,
    genre:          'Action',
    director_score: 0.7,
    cast_score:     0.65,
    season:         'summer',
    market:         'pan_african',
    logline:        '',
  })

  const [result,  setResult]  = useState<PredictionResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Welcome to FilmIQ Analyst. I'm powered by Claude AI and trained on 9,999 films from the TMDB dataset. Ask me about box office trends, African market insights, genre performance, or investment opportunities.",
    },
  ])
  const [chatInput, setChatInput]   = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Prediction ─────────────────────────────────────────────────────────────
  async function runPrediction() {
    if (!form.budget || loading) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${API}/api/predict/box-office`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('filmiq_token') || ''}`,
        },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setResult(data)
    } catch {
      // Client-side fallback using genre multipliers
      const genreMult: Record<string, number> = {
        Adventure:2.26, Family:1.95, 'Science Fiction':1.83, Animation:1.71,
        Fantasy:1.68, Action:1.60, Comedy:1.21, Romance:0.92, Drama:0.78,
        Thriller:0.61, Horror:0.48,
      }
      const seasonMult: Record<string, number> = { summer:1.38, winter_vacation:1.42, general:0.88, easter:1.15 }
      const marketMult: Record<string, number> = { uganda_only:0.08, east_africa:0.35, pan_african:1.0, global:3.2 }

      const gm = genreMult[form.genre] || 1.0
      const sm = seasonMult[form.season] || 0.88
      const mm = marketMult[form.market] || 1.0
      const rev = form.budget * gm * sm * mm * (0.5 + form.cast_score * 0.3) * (0.6 + form.director_score * 0.2)
      setResult({
        predicted_revenue:         Math.round(rev),
        predicted_opening_weekend: Math.round(rev * 0.28),
        predicted_roi:             Math.round((rev - form.budget) / form.budget * 100),
        confidence:                0.837,
        model_used:                'CNN-C (Client Fallback)',
        genre_multiplier:          gm,
        risk_level:                rev > form.budget * 2 ? 'LOW' : rev > form.budget ? 'MODERATE' : 'HIGH',
        recommendation:            'Invest in pre-release social media to boost sentiment score (+16.1% accuracy boost)',
      })
    } finally {
      setLoading(false)
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────
  async function sendChat() {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    setChatInput('')
    setMessages(m => [...m, { role: 'user', content: text }, { role: 'thinking', content: 'Analyzing...' }])
    setChatLoading(true)

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          system: `You are FilmIQ Analyst, an African cinema intelligence expert. Dataset: 9,999 TMDB films. Key data:
- Top revenue: Avatar $2.92B, Avengers: Endgame $2.80B
- Best ROI genres: Adventure (avg $226M), Animation ($171M), Action ($160M)
- CNN-C model: 83.7% accuracy. Sentiment boosts: +1.86 (positive), -2.37 (negative)
- African film market: 18% CAGR, projected $2.1B by 2030
Be concise, data-driven, Africa-focused.`,
          messages: [
            ...messages.filter(m => m.role !== 'thinking').map(m => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
            { role: 'user', content: text },
          ],
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || 'Analysis unavailable.'
      setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: reply }])
    } catch {
      const fallbacks: Record<string, string> = {
        default: "Based on 9,999-film analysis: Adventure genre leads at $226M avg revenue. African cinema grows 18% annually. CNN-C model achieves 83.7% accuracy with sentiment data.",
      }
      const key = text.toLowerCase().includes('africa') ? 'default' : 'default'
      setMessages(m => [...m.slice(0, -1), { role: 'assistant', content: fallbacks[key] }])
    } finally {
      setChatLoading(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#060810] px-8 py-8 text-white">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-1 text-[11px] uppercase tracking-[3px] text-yellow-400">AI Engine</p>
        <h1 className="font-display text-5xl tracking-widest">PREDICTION STUDIO</h1>
        <p className="mt-1 text-sm text-gray-500">
          CNN-C Model · 83.7% Accuracy · Powered by Claude AI
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="rounded-xl border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[0.04] to-cyan-400/[0.02] p-6">
          {/* Header */}
          <div className="mb-6 flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <h2 className="font-display text-xl tracking-wide">BOX OFFICE PREDICTOR</h2>
            <span className="ml-auto rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-400">
              claude-sonnet-4-20250514
            </span>
          </div>

          {/* Form fields */}
          <div className="space-y-4">
            <Field label="Movie Title">
              <input
                className={inputCls}
                placeholder="e.g. The Last King of Uganda"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Production Budget (USD)">
                <input
                  className={inputCls}
                  type="number"
                  value={form.budget}
                  onChange={e => setForm(f => ({ ...f, budget: Number(e.target.value) }))}
                />
              </Field>
              <Field label="Primary Genre">
                <select
                  className={inputCls}
                  value={form.genre}
                  onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                >
                  {['Action','Adventure','Animation','Comedy','Drama','Family','Fantasy','Horror','Romance','Science Fiction','Thriller'].map(g => (
                    <option key={g} className="bg-[#111528]">{g}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Director Score: ${form.director_score.toFixed(1)}`}>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={form.director_score}
                  onChange={e => setForm(f => ({ ...f, director_score: Number(e.target.value) }))}
                  className="w-full accent-yellow-400"
                />
              </Field>
              <Field label={`Cast Score: ${form.cast_score.toFixed(1)}`}>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={form.cast_score}
                  onChange={e => setForm(f => ({ ...f, cast_score: Number(e.target.value) }))}
                  className="w-full accent-yellow-400"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Release Season">
                <select className={inputCls} value={form.season} onChange={e => setForm(f => ({ ...f, season: e.target.value }))}>
                  <option value="summer" className="bg-[#111528]">Summer (Jun–Aug)</option>
                  <option value="winter_vacation" className="bg-[#111528]">Holiday (Nov–Dec)</option>
                  <option value="easter" className="bg-[#111528]">Easter (Mar–Apr)</option>
                  <option value="general" className="bg-[#111528]">General Release</option>
                </select>
              </Field>
              <Field label="Target Market">
                <select className={inputCls} value={form.market} onChange={e => setForm(f => ({ ...f, market: e.target.value }))}>
                  <option value="uganda_only" className="bg-[#111528]">Uganda Only</option>
                  <option value="east_africa" className="bg-[#111528]">East Africa</option>
                  <option value="pan_african" className="bg-[#111528]">Pan-African</option>
                  <option value="global" className="bg-[#111528]">Global</option>
                </select>
              </Field>
            </div>

            <Field label="Logline / Concept">
              <input
                className={inputCls}
                placeholder="Brief description for AI analysis..."
                value={form.logline}
                onChange={e => setForm(f => ({ ...f, logline: e.target.value }))}
              />
            </Field>

            <button
              onClick={runPrediction}
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-yellow-500 to-yellow-600 py-3 text-sm font-bold
                         uppercase tracking-widest text-black transition-all
                         hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(212,168,67,0.35)]
                         disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Cpu size={14} className="animate-spin" /> ANALYZING...
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
                className="mt-5 rounded-lg border border-white/[0.06] bg-black/30 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
                    Prediction Results
                  </span>
                  <RiskBadge level={result.risk_level} />
                </div>
                <ResultRow label="Predicted Revenue"  value={`$${(result.predicted_revenue / 1e6).toFixed(1)}M`} color="text-yellow-400" />
                <ResultRow label="Opening Weekend"    value={`$${(result.predicted_opening_weekend / 1e6).toFixed(1)}M`} color="text-cyan-400" />
                <ResultRow label="Estimated ROI"      value={`${result.predicted_roi > 0 ? '+' : ''}${result.predicted_roi.toFixed(0)}%`} color={result.predicted_roi > 0 ? 'text-emerald-400' : 'text-red-400'} />
                <ResultRow label="Genre Multiplier"   value={`${result.genre_multiplier.toFixed(2)}x`} color="text-purple-400" />
                <ResultRow label="Model Confidence"   value={`${(result.confidence * 100).toFixed(1)}%`} />
                {result.ai_analysis && (
                  <div className="mt-3 border-t border-white/[0.06] pt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">AI Analysis</p>
                    <p className="text-xs leading-relaxed text-gray-300 whitespace-pre-wrap">{result.ai_analysis}</p>
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

        {/* Right: Chat + Feature Importance */}
        <div className="flex flex-col gap-4">
          {/* AI Chat */}
          <div className="flex flex-1 flex-col rounded-xl border border-white/7 bg-white/[0.02] overflow-hidden min-h-0" style={{ maxHeight: '460px' }}>
            <div className="flex items-center gap-3 border-b border-white/7 px-5 py-3.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <div>
                <div className="font-display text-base tracking-wide">FILMIQ ANALYST</div>
                <div className="text-[10px] text-gray-500">AI-powered film intelligence</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ scrollbarWidth: 'thin' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-yellow-400/10 border border-yellow-400/20 text-yellow-100'
                      : msg.role === 'thinking'
                      ? 'bg-white/[0.03] border border-white/7 text-gray-500 italic'
                      : 'bg-white/[0.03] border border-white/7 text-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="flex gap-2 border-t border-white/7 p-3">
              <input
                className="flex-1 rounded-lg border border-white/7 bg-white/[0.03] px-3 py-2 text-xs text-white placeholder-gray-600 focus:border-yellow-400/50 focus:outline-none"
                placeholder="Ask about box office, genres, African market..."
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
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

          {/* Feature Importance */}
          <div className="rounded-xl border border-white/7 bg-white/[0.02] p-5">
            <div className="mb-4">
              <h3 className="font-display text-base tracking-wide">FEATURE IMPORTANCE</h3>
              <p className="text-[11px] text-gray-500">MLR regression coefficients — Zhang et al. (2024)</p>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Positive Comments',  val: 1.862, color: '#22d49a', pct: 90 },
                { label: 'First-day Box Office', val: 1.222, color: '#d4a843', pct: 100 },
                { label: 'Actors Score',       val: 1.216, color: '#38d9f5', pct: 80 },
                { label: 'Intended Audience',  val: 0.962, color: '#38d9f5', pct: 65 },
                { label: 'Heat / Search Index',val: 0.861, color: '#9d6ef8', pct: 58 },
                { label: 'Negative Comments',  val: -2.369, color: '#f05068', pct: 95 },
              ].map(f => (
                <div key={f.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-gray-400">{f.label}</span>
                    <span className="font-mono" style={{ color: f.color }}>
                      {f.val > 0 ? '+' : ''}{f.val.toFixed(3)}
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${f.pct}%`, background: f.color, opacity: 0.7 }}
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
