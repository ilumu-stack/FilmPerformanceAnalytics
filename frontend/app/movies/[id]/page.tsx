'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Star, Calendar, DollarSign, TrendingUp, Clock, Users, Flame } from 'lucide-react'
import { MovieBackdrop } from '@/components/ui/MovieBackdrop'
import { MoviePoster } from '@/components/ui/MoviePoster'
import { movies } from '@/lib/api'
import type { Movie } from '@/lib/api'
import { formatMoney, formatROI, formatDate } from '@/lib/utils'

export default function MovieDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const movieId = Number(params.id)

  const [movie,   setMovie]   = useState<Movie | null>(null)
  const [similar, setSimilar] = useState<Movie[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!Number.isFinite(movieId)) { setError(true); setLoading(false); return }
    movies.get(movieId)
      .then(setMovie)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
    movies.similar(movieId, 8).then(setSimilar).catch(() => setSimilar([]))
  }, [movieId])

  if (loading) return <DetailSkeleton />

  if (error || !movie) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-8 text-center">
        <p className="mb-4 text-lg font-semibold text-navy">Movie not found</p>
        <button onClick={() => router.push('/movies')} className="btn-primary">Back to Movies</button>
      </div>
    )
  }

  const tm = movie.trend_metrics

  return (
    <div className="min-h-screen">
      {/* Hero backdrop */}
      <MovieBackdrop src={movie.backdrop_url} title={movie.title} className="h-[360px] w-full">
        <div className="mx-auto flex h-full max-w-6xl items-end px-8 pb-8">
          <div>
            <Link href="/movies" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-300 hover:text-white">
              <ChevronLeft size={14} /> Back to Movies
            </Link>
            <h1 className="text-4xl font-bold text-white">{movie.title}</h1>
            {movie.tagline && <p className="mt-1 text-sm italic text-slate-300">{movie.tagline}</p>}
            <div className="mt-2 flex items-center gap-4 text-sm text-slate-300">
              <span className="flex items-center gap-1"><Calendar size={14} /> {formatDate(movie.release_date ?? '')}</span>
              <span className="flex items-center gap-1"><Star size={14} className="text-amber-400" /> {movie.vote_average?.toFixed(1) ?? '—'} ({movie.vote_count?.toLocaleString() ?? 0} votes)</span>
              {movie.runtime ? <span className="flex items-center gap-1"><Clock size={14} /> {movie.runtime} min</span> : null}
            </div>
          </div>
        </div>
      </MovieBackdrop>

      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          {/* Poster */}
          <MoviePoster src={movie.poster_url} title={movie.title} className="aspect-[2/3] w-full -mt-20 shadow-card-hover" priority />

          {/* Details */}
          <div>
            <div className="mb-6 flex flex-wrap gap-2">
              {(movie.genres ?? []).map((g) => (
                <span key={g} className="badge-blue">{g}</span>
              ))}
              {movie.original_language && <span className="badge-purple">{movie.original_language.toUpperCase()}</span>}
            </div>

            {movie.overview && (
              <p className="mb-6 max-w-3xl leading-relaxed text-slate-600">{movie.overview}</p>
            )}

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <StatBox icon={DollarSign} label="Budget"     value={formatMoney(movie.budget, true)} />
              <StatBox icon={DollarSign} label="Revenue"    value={formatMoney(movie.revenue, true)} color="text-brand" />
              <StatBox icon={TrendingUp} label="ROI"        value={movie.roi != null ? formatROI(movie.roi) : '—'} color="text-emerald-600" />
              <StatBox icon={Star}       label="Rating"     value={movie.vote_average?.toFixed(1) ?? '—'} color="text-amber-600" />
              <StatBox icon={Flame}      label="Popularity" value={movie.popularity?.toFixed(0) ?? '—'} color="text-rose-600" />
              <StatBox icon={Users}      label="Votes"      value={movie.vote_count?.toLocaleString() ?? '—'} />
              <StatBox icon={Clock}      label="Runtime"    value={movie.runtime ? `${movie.runtime} min` : '—'} />
              <StatBox icon={Calendar}   label="Director"   value={movie.director ?? '—'} />
            </div>

            {movie.cast && movie.cast.length > 0 && (
              <div className="mt-6">
                <p className="section-label mb-2">Cast</p>
                <div className="flex flex-wrap gap-2">
                  {movie.cast.map((c) => (
                    <span key={c} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{c}</span>
                  ))}
                </div>
              </div>
            )}

            {(movie.production_companies?.length || movie.production_countries?.length) ? (
              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {movie.production_companies && movie.production_companies.length > 0 && (
                  <div>
                    <p className="section-label mb-2">Production</p>
                    <p className="text-sm text-slate-600">{movie.production_companies.join(', ')}</p>
                  </div>
                )}
                {movie.production_countries && movie.production_countries.length > 0 && (
                  <div>
                    <p className="section-label mb-2">Countries</p>
                    <p className="text-sm text-slate-600">{movie.production_countries.join(', ')}</p>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Trend metrics */}
        {tm && (
          <div className="mt-10 card p-6">
            <h2 className="mb-4 text-[15px] font-semibold text-navy">How It Ranks</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <PercentileBox label="Rating vs. genre" pct={tm.rating_percentile_in_genre} sub={`of ${tm.genre_peer_count.toLocaleString()} genre peers`} />
              <PercentileBox label="Popularity vs. genre" pct={tm.popularity_percentile_in_genre} sub={`of ${tm.genre_peer_count.toLocaleString()} genre peers`} />
              {tm.revenue_percentile_in_genre != null && (
                <PercentileBox label="Revenue vs. genre" pct={tm.revenue_percentile_in_genre} sub="among genre peers with financial data" />
              )}
              {tm.popularity_percentile_in_year != null && (
                <PercentileBox label="Popularity vs. release year" pct={tm.popularity_percentile_in_year} sub={`of ${tm.year_peer_count?.toLocaleString()} films released ${movie.year}`} />
              )}
            </div>
          </div>
        )}

        {/* Similar movies */}
        {similar.length > 0 && (
          <div className="mt-10">
            <h2 className="mb-4 text-[15px] font-semibold text-navy">Similar Movies</h2>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-8">
              {similar.map((m) => (
                <Link key={m.id} href={`/movies/${m.id}`} className="group">
                  <MoviePoster src={m.poster_url} title={m.title} className="aspect-[2/3] w-full shadow-card transition-transform group-hover:-translate-y-1 group-hover:shadow-card-hover" />
                  <p className="mt-2 truncate text-xs font-semibold text-slate-800 group-hover:text-brand">{m.title}</p>
                  {m.similarity_score != null && (
                    <p className="text-[11px] text-slate-400">{Math.round(m.similarity_score * 100)}% match</p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function PercentileBox({ label, pct, sub }: { label: string; pct: number; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[2px] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-navy">Top {Math.max(0, 100 - pct).toFixed(0)}%</p>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
    </div>
  )
}

function StatBox({ icon: Icon, label, value, color = 'text-navy' }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="card p-4">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`truncate text-xl font-bold ${color}`}>{value}</div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="h-[360px] w-full animate-pulse bg-slate-200" />
      <div className="mx-auto max-w-6xl px-8 py-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr]">
          <div className="aspect-[2/3] w-full -mt-20 animate-pulse rounded-lg bg-slate-300" />
          <div className="space-y-3">
            <div className="h-4 w-1/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
          </div>
        </div>
      </div>
    </div>
  )
}
