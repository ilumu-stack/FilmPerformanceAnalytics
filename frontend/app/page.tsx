'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  TrendingUp, BarChart2, Cpu, Globe, ArrowRight,
  CheckCircle, Film, Users, DollarSign, Zap,
  ChevronRight, Star, Shield, Database,
  Target, Briefcase, Calendar, MessageSquare, GraduationCap,
} from 'lucide-react'
import { MovieBackdrop } from '@/components/ui/MovieBackdrop'
import { MoviePoster } from '@/components/ui/MoviePoster'
import { movies, analytics } from '@/lib/api'
import type { Movie } from '@/lib/api'
import { formatMoney, formatROI } from '@/lib/utils'

// ── Animation helpers ──────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
}
const stagger = { show: { transition: { staggerChildren: 0.12 } } }

// ── Data ───────────────────────────────────────────────────────────────────
// STATS is built at runtime from real dataset/model numbers (see useEffect
// below) — there is no Ugandan-market CAGR data anywhere in this product, so
// the previous "+18% Ugandan Market CAGR" card is gone rather than invented.

const FEATURES = [
  {
    icon: Cpu,
    title: 'AI Box Office Prediction',
    description:
      'Our CNN-C ensemble model analyzes genre, budget, cast, and timing to forecast box-office revenue from historical TMDB data.',
  },
  {
    icon: BarChart2,
    title: 'Deep Market Analytics',
    description:
      'Explore genre trends, seasonal performance, audience segments, and year-over-year revenue trajectories across the Ugandan film market.',
  },
  {
    icon: DollarSign,
    title: 'Investment Intelligence',
    description:
      'Risk-adjusted ROI modeling, investment opportunity scoring, and portfolio analytics designed specifically for film financiers.',
  },
  {
    icon: Globe,
    title: 'Ugandan Market Focus',
    description:
      'Hyper-focused on Uganda\'s film industry, with localized data and regional benchmarks tailored to the Ugandan market.',
  },
  {
    icon: Film,
    title: 'Filmmaker Studio',
    description:
      'Submit projects, track performance, and get AI-driven feedback on your film\'s commercial viability before going into production.',
  },
  {
    icon: Zap,
    title: 'Real-Time Data Pipeline',
    description:
      'Live data feeds with automated ETL from TMDB and regional sources keep your analytics current without manual refresh.',
  },
]

const USE_CASES = [
  {
    icon: Target,
    title: 'Pre-Production Risk Assessment',
    description:
      'Test budget, cast, and genre combinations before committing capital, so you greenlight projects backed by data instead of gut feel.',
    outcome: 'Avoid costly production missteps',
  },
  {
    icon: Briefcase,
    title: 'Investment Due Diligence',
    description:
      'Evaluate a film\'s risk-adjusted ROI and benchmark it against historical comparables before wiring funds to a production.',
    outcome: 'Allocate capital with confidence',
  },
  {
    icon: Calendar,
    title: 'Release Date Optimization',
    description:
      'Identify the seasonal windows and release patterns that historically maximize opening-weekend and total box office for your genre.',
    outcome: 'Capture stronger opening-weekend uplift',
  },
  {
    icon: MessageSquare,
    title: 'Audience Sentiment Monitoring',
    description:
      'Track pre-release buzz and sentiment trends to forecast word-of-mouth momentum and adjust marketing spend in real time.',
    outcome: 'Catch sentiment shifts before launch',
  },
  {
    icon: BarChart2,
    title: 'Market & Portfolio Research',
    description:
      'Benchmark genre performance, regional trends, and competitor releases across the Ugandan film market.',
    outcome: 'Spot underserved genres with high ROI',
  },
  {
    icon: GraduationCap,
    title: 'Academic & Industry Research',
    description:
      'Explore a structured dataset of thousands of films for coursework, theses, or industry studies on Ugandan cinema economics.',
    outcome: 'Built on real TMDB-sourced data',
  },
]

const STEPS = [
  {
    number: '01',
    title: 'Create Your Account',
    description: 'Get access as a filmmaker, investor, or analyst. Your role determines your personalized dashboard and toolset.',
  },
  {
    number: '02',
    title: 'Explore the Data',
    description: 'Dive into 9,999+ films worth of historical performance data, genre breakdowns, and market trends.',
  },
  {
    number: '03',
    title: 'Run AI Predictions',
    description: 'Input your film\'s attributes and receive a revenue prediction, confidence range, and comparable titles.',
  },
  {
    number: '04',
    title: 'Make Confident Decisions',
    description: 'Use data-backed insights to greenlight projects, structure deals, and time releases for maximum impact.',
  },
]

const BENEFITS = [
  'Replace gut-feel decisions with data-backed confidence',
  'Identify underserved genres with high ROI potential',
  'Benchmark your project against historical comparables',
  'Optimize release timing with seasonal analysis',
  'Attract investors with professional analytics reports',
  'Track your film portfolio performance in real time',
]

// ── Page ───────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const [featured, setFeatured] = useState<Movie[]>([])
  const [stats, setStats] = useState<{
    totalFilms: number | null
    bestR2: number | null
    peakRevenue: number | null
    avgRoi: number | null
  }>({ totalFilms: null, bestR2: null, peakRevenue: null, avgRoi: null })

  useEffect(() => {
    movies.featured(6).then(setFeatured).catch(console.error)
    Promise.all([analytics.dashboard(), analytics.modelAccuracy()])
      .then(([dash, acc]) => setStats({
        totalFilms:  dash.kpis.total_films,
        peakRevenue: dash.kpis.peak_revenue,
        avgRoi:      dash.kpis.avg_roi,
        bestR2:      acc.best_r2,
      }))
      .catch(console.error)
  }, [])

  const STATS = [
    { value: stats.totalFilms != null ? `${stats.totalFilms.toLocaleString()}+` : '—', label: 'Films Analyzed' },
    { value: stats.bestR2     != null ? `${stats.bestR2}%` : '—',                       label: 'Model Accuracy (R²)' },
    { value: stats.peakRevenue != null ? formatMoney(stats.peakRevenue, true) : '—',    label: 'Peak Box Office Tracked' },
    { value: stats.avgRoi     != null ? formatROI(stats.avgRoi) : '—',                  label: 'Average ROI (films with financial data)' },
  ]

  const heroBackdrop = featured[0]?.backdrop_url

  return (
    <div className="min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 pb-24 pt-20">
        {/* Cinematic backdrop, dimmed behind the gradient */}
        {heroBackdrop && (
          <MovieBackdrop
            src={heroBackdrop}
            title={featured[0]?.title ?? 'Featured film'}
            className="absolute inset-0 opacity-30"
            overlay={false}
            priority
          />
        )}
        {/* Background texture */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-navy-950/70 via-navy-900/80 to-navy-800" />
          <div className="absolute -top-40 left-1/2 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-brand/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-navy-700/40 blur-[80px]" />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
          />
        </div>

        <div className="relative mx-auto max-w-6xl px-6">
          <motion.div variants={stagger} initial="hidden" animate="show" className="text-center">

            {/* Eyebrow pill */}
            <motion.div variants={fadeUp} className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-blue-300 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
                </span>
                Uganda's Cinema Intelligence Platform
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={fadeUp}
              className="mx-auto mb-6 max-w-4xl text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              Data-Driven Intelligence
              <span className="block bg-gradient-to-r from-blue-300 to-brand-light bg-clip-text text-transparent">
                for Ugandan Cinema
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p variants={fadeUp} className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-slate-300">
              Predict box office performance, decode audience behavior, and uncover investment
              opportunities with our AI-powered analytics platform built for the Ugandan film market.
            </motion.p>

            {/* CTAs */}
            <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-xl hover:shadow-brand/40"
              >
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all duration-200 hover:bg-white/10 hover:border-white/30"
              >
                Sign In
              </Link>
            </motion.div>

            {/* Social proof line */}
            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" /> No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" /> TMDB-powered dataset
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-emerald-400" /> Enterprise-grade security
              </span>
            </motion.div>
          </motion.div>

          {/* Dashboard preview mockup */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7, ease: 'easeOut' }}
            className="mt-16 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-1 shadow-2xl shadow-black/40 backdrop-blur-sm"
          >
            <div className="rounded-xl bg-navy-950/80 p-6">
              {/* Browser chrome */}
              <div className="mb-5 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400/50" />
                <div className="h-3 w-3 rounded-full bg-amber-400/50" />
                <div className="h-3 w-3 rounded-full bg-emerald-400/50" />
                <div className="ml-3 flex-1 rounded-md bg-white/10 px-3 py-1 text-[11px] text-slate-400">
                  app.filmiq.africa/dashboard
                </div>
              </div>
              {/* Mock KPI row */}
              <div className="mb-3 grid grid-cols-4 gap-3">
                {[
                  { label: 'Total Films',    value: '9,999',  color: 'text-blue-400',    Icon: Film       },
                  { label: 'Avg Revenue',    value: '$98M',   color: 'text-emerald-400', Icon: DollarSign },
                  { label: 'Avg ROI',        value: '284%',   color: 'text-amber-400',   Icon: TrendingUp },
                  { label: 'AI Accuracy',    value: '83.7%',  color: 'text-purple-400',  Icon: Cpu        },
                ].map(({ label, value, color, Icon }) => (
                  <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-4">
                    <div className="mb-2 flex items-center gap-1.5">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  </div>
                ))}
              </div>
              {/* Mock chart */}
              <div className="flex h-14 items-end gap-1.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2">
                {[40,65,45,80,55,90,70,85,60,75,95,68].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-brand/60" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Trending Films ───────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="bg-white py-16">
          <div className="mx-auto max-w-6xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-8 flex items-end justify-between"
            >
              <div>
                <p className="section-label mb-2">Live From Our Dataset</p>
                <h2 className="text-3xl font-bold text-navy">Trending Films</h2>
              </div>
              <Link href="/auth/login" className="hidden items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark sm:flex">
                Explore all films <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>

            <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-6">
              {featured.map((m, i) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06, duration: 0.4 }}
                >
                  <MoviePoster src={m.poster_url} title={m.title} className="aspect-[2/3] w-full shadow-card" />
                  <p className="mt-2 truncate text-sm font-semibold text-slate-800">{m.title}</p>
                  <p className="text-[11px] font-medium text-brand">{formatMoney(m.revenue, true)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Stats strip ───────────────────────────────────────────────────── */}
      <section className="border-y border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {STATS.map(({ value, label }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
                className="text-center"
              >
                <div className="text-3xl font-bold text-navy">{value}</div>
                <div className="mt-1 text-sm text-slate-500">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── About / Problem We Solve ──────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <p className="section-label mb-3">The Problem We Solve</p>
            <h2 className="mb-4 text-4xl font-bold text-navy">
              Ugandan Cinema Deserves Better Data
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-slate-500">
              Filmmakers and investors in Uganda make multi-million dollar decisions with limited
              data, outdated benchmarks, and no predictive tools. FilmIQ changes that.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              {
                Icon: Users,
                title: 'The Challenge',
                bg: 'bg-red-50 text-red-600 border-red-100',
                description:
                  'Industry professionals rely on anecdotal evidence and outdated Western benchmarks that don\'t apply to the unique dynamics of Ugandan cinema markets.',
              },
              {
                Icon: Database,
                title: 'Our Solution',
                bg: 'bg-blue-50 text-blue-600 border-blue-100',
                description:
                  'FilmIQ aggregates regional box office data, social signals, and historical performance to train AI models purpose-built for Ugandan cinema.',
              },
              {
                Icon: Star,
                title: 'The Outcome',
                bg: 'bg-emerald-50 text-emerald-600 border-emerald-100',
                description:
                  'Decision-makers get accurate revenue forecasts, risk-adjusted investment guidance, and audience intelligence — all in one platform.',
              },
            ].map(({ Icon, title, description, bg }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="card p-7"
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl border ${bg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-navy">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{description}</p>
              </motion.div>
            ))}
          </div>

          {/* Benefits grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 rounded-2xl border border-navy-100 bg-navy-50 p-8"
          >
            <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest text-navy">
              What You Can Do With FilmIQ
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((b) => (
                <div key={b} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                  {b}
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Features grid ─────────────────────────────────────────────────── */}
      <section className="bg-filmiq-bg2 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-14 text-center"
          >
            <p className="section-label mb-3">Platform Capabilities</p>
            <h2 className="mb-4 text-4xl font-bold text-navy">Everything You Need to Succeed</h2>
            <p className="mx-auto max-w-xl text-lg text-slate-500">
              Six powerful tools, one unified platform — built for filmmakers, investors, and
              analysts in the Ugandan cinema industry.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="group card-hover p-6"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-navy">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="use-cases-heading" className="bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-14 text-center"
          >
            <p className="section-label mb-3">Real-World Applications</p>
            <h2 id="use-cases-heading" className="mb-4 text-4xl font-bold text-navy">
              Built for Every Role in the Film Business
            </h2>
            <p className="mx-auto max-w-xl text-lg text-slate-500">
              From greenlighting a script to closing an investment round, FilmIQ adapts to how
              you actually make decisions.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map(({ icon: Icon, title, description, outcome }, i) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.45 }}
                className="group card-hover flex flex-col p-6"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-navy">{title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{description}</p>
                {outcome && (
                  <p className="mt-4 flex items-start gap-1.5 text-xs font-medium text-emerald-600">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    {outcome}
                  </p>
                )}
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="mb-14 text-center"
          >
            <p className="section-label mb-3">Simple Workflow</p>
            <h2 className="mb-4 text-4xl font-bold text-navy">How FilmIQ Works</h2>
            <p className="mx-auto max-w-xl text-lg text-slate-500">
              From sign-up to actionable intelligence in four straightforward steps.
            </p>
          </motion.div>

          <div className="relative">
            {/* Connector line (desktop) */}
            <div className="absolute left-[12.5%] right-[12.5%] top-9 hidden h-px bg-gradient-to-r from-slate-200 via-brand/40 to-slate-200 lg:block" />

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
              {STEPS.map(({ number, title, description }, i) => (
                <motion.div
                  key={number}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.12, duration: 0.5 }}
                  className="relative flex flex-col items-center text-center"
                >
                  <div className="relative z-10 mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl border-2 border-brand bg-white shadow-md shadow-brand/10">
                    <span className="text-xl font-bold text-brand">{number}</span>
                  </div>
                  <h3 className="mb-2 text-base font-semibold text-navy">{title}</h3>
                  <p className="text-sm leading-relaxed text-slate-500">{description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-navy-950 via-navy-900 to-navy-800 py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold text-blue-300">
              <Shield className="h-3.5 w-3.5" /> Enterprise-Grade Security
            </div>
            <h2 className="mb-5 text-4xl font-bold text-white">
              Ready to Transform How You Make Film Decisions?
            </h2>
            <p className="mb-8 text-lg text-slate-300">
              Join filmmakers, investors, and analysts already using FilmIQ to gain a competitive
              edge in the Ugandan cinema market.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-8 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition-all hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-xl"
              >
                Get Started Today
                <ChevronRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-8 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10"
              >
                Sign In to Your Account
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy">
                <Film className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight text-navy">FilmIQ</span>
              <span className="ml-1 text-sm text-slate-400">— Ugandan Cinema Intelligence</span>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
              <Link href="/auth/login" className="transition-colors hover:text-navy">Sign In</Link>
              <Link href="/auth/login" className="transition-colors hover:text-navy">Contact</Link>
              <span className="text-slate-300">|</span>
              <Link href="/auth/login" className="transition-colors hover:text-navy">Privacy Policy</Link>
              <Link href="/auth/login" className="transition-colors hover:text-navy">Terms of Service</Link>
            </div>
          </div>
          <div className="mt-8 border-t border-slate-100 pt-6 text-center text-xs text-slate-400">
            © {new Date().getFullYear()} FilmIQ. All rights reserved. Powered by TMDB data and AI.
          </div>
          <div className="mt-2 text-center text-xs text-slate-400">
            Developed by Makerere University — College of Computing and Information Sciences, Department of Information Systems — BIST III Group 50
          </div>
        </div>
      </footer>
    </div>
  )
}
