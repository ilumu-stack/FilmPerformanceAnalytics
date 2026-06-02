'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'

const FEATURES = [
  { icon: '📊', title: 'BOX OFFICE PREDICTION',    desc: 'CNN-C model trained on 9,999 films achieves 83.7% accuracy. Predict revenue, ROI, and opening weekend from budget, genre, cast, and release timing.' },
  { icon: '🧠', title: 'SENTIMENT ANALYSIS',       desc: 'TF-IDF weighted emotional scoring: F_i = (W_i − 0.5) × Σ(T_ij + 1). Positive comments boost prediction by +16.1%, negative by −2.37 coefficient.' },
  { icon: '🌍', title: 'AFRICAN MARKET INSIGHTS',  desc: 'Specialized analytics for Uganda, Nigeria, Kenya, Ghana. 18% CAGR market growing to $2.1B by 2030. Pan-African distribution strategy tools.' },
  { icon: '💰', title: 'INVESTOR INTELLIGENCE',    desc: 'ROI forecasts, risk matrix, and investment opportunity scoring. Adventure genre leads at 812% avg ROI; Thriller at −12% — know before you invest.' },
  { icon: '🎬', title: 'CAST & CREW SCORING',      desc: 'Actor popularity score contributes MLR coefficient of 1.22x; director score 1.02x. Quantify your talent investment before greenlight.' },
  { icon: '📡', title: 'TREND FORECASTING',        desc: 'Genre trajectory 2015–2025. Streaming vs. cinema crossover analysis. Seasonal release optimization with month-level revenue heatmaps.' },
]

const STATS = [
  { num: '9,999', label: 'Films Analyzed' },
  { num: '$2.92B', label: 'Peak Revenue' },
  { num: '83.7%',  label: 'Model Accuracy' },
  { num: '+18%',   label: 'African CAGR' },
]

export default function LandingPage() {
  return (
    <div className="relative min-h-screen">

      {/* Hero */}
      <section className="flex min-h-[calc(100vh-88px)] flex-col items-center justify-center px-8 py-20 text-center">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="section-label mb-6"
        >
          Uganda &amp; Africa Film Intelligence Platform
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display text-[clamp(56px,10vw,128px)] leading-[0.92] tracking-[4px]
                     bg-gradient-to-br from-white via-white to-yellow-200 bg-clip-text text-transparent"
        >
          FILM DATA<br />ANALYTICS
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.7 }}
          transition={{ delay: 0.2 }}
          className="mt-4 font-display text-[clamp(18px,3vw,32px)] tracking-[10px] text-cyan-400"
        >
          POWERED BY AI
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-8 max-w-xl text-[15px] leading-relaxed text-gray-400"
        >
          Data-Driven Intelligence for African Cinema. Predict box office performance,
          analyze audience sentiment, and uncover investment opportunities across the
          continent&apos;s fastest-growing entertainment market.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <Link href="/dashboard" className="btn-primary">Open Dashboard</Link>
          <Link href="/predict"   className="btn-ghost">Try AI Prediction</Link>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-16 grid w-full max-w-3xl grid-cols-4 divide-x divide-white/[0.07]
                     overflow-hidden rounded-xl border border-white/[0.07] bg-filmiq-bg2"
        >
          {STATS.map(({ num, label }) => (
            <div key={label} className="py-6 text-center">
              <div className="font-display text-4xl tracking-wide text-yellow-400">{num}</div>
              <div className="mt-1 text-[11px] uppercase tracking-[2px] text-gray-500">{label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-8 pb-32">
        <p className="section-label mb-4">Platform Capabilities</p>
        <h2 className="mb-14 font-display text-5xl tracking-[3px]">INTELLIGENCE SUITE</h2>
        <div className="grid grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="group glass-card p-8 transition-all duration-300
                         hover:-translate-y-1 hover:border-yellow-400/20"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="mb-3 font-display text-xl tracking-wide">{f.title}</h3>
              <p className="text-[13px] leading-relaxed text-gray-500">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  )
}
