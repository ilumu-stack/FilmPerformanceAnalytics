'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, Star, SlidersHorizontal, X } from 'lucide-react'
import { MoviePoster } from '@/components/ui/MoviePoster'
import { movies } from '@/lib/api'
import type { Movie, MovieFilters } from '@/lib/api'
import { formatMoney } from '@/lib/utils'

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
  'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance',
  'Science Fiction', 'Thriller', 'War', 'Western',
]

const EMPTY_FILTERS: MovieFilters = { sort: 'revenue' }

export default function MoviesPage() {
  const [list,    setList]    = useState<Movie[]>([])
  const [query,   setQuery]   = useState('')
  const [filters, setFilters] = useState<MovieFilters>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query.trim()
    setLoading(true)
    const timer = setTimeout(() => {
      const request = q.length >= 2 ? movies.search(q) : movies.list(1, 24, filters)
      request.then(setList).catch(console.error).finally(() => setLoading(false))
    }, q ? 350 : 0)
    return () => clearTimeout(timer)
  }, [query, filters])

  const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'sort' && v).length

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-label mb-1">Film Database</p>
          <h1 className="text-4xl font-bold text-navy">Browse Movies</h1>
          <p className="mt-1 text-sm text-slate-400">Explore the dataset with TMDb artwork and live metadata</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="btn-outline flex items-center gap-2 text-sm"
          >
            <SlidersHorizontal size={15} />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title…"
              className="input-field pl-9"
            />
          </div>
        </div>
      </div>

      {showFilters && !query && (
        <FilterPanel filters={filters} onChange={setFilters} onClear={() => setFilters(EMPTY_FILTERS)} />
      )}

      {loading ? (
        <MovieGridSkeleton />
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center justify-center gap-2 py-16 text-center">
          <p className="text-sm text-slate-500">
            {query ? <>No movies match &ldquo;{query}&rdquo;.</> : 'No movies match these filters.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {list.map((m) => (
            <Link key={m.id} href={`/movies/${m.id}`} className="group">
              <MoviePoster src={m.poster_url} title={m.title} className="aspect-[2/3] w-full shadow-card transition-transform group-hover:-translate-y-1 group-hover:shadow-card-hover" />
              <div className="mt-2">
                <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand">{m.title}</p>
                <div className="mt-0.5 flex items-center justify-between text-xs text-slate-400">
                  <span>{m.release_date?.slice(0, 4) ?? '—'}</span>
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-400" />
                    {m.vote_average?.toFixed(1) ?? '—'}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium text-brand">{formatMoney(m.revenue, true)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterPanel({ filters, onChange, onClear }: {
  filters: MovieFilters
  onChange: (f: MovieFilters) => void
  onClear: () => void
}) {
  function set<K extends keyof MovieFilters>(key: K, value: MovieFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="mb-6 card p-5">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[2px] text-slate-400">Multi-condition filters</span>
        <button onClick={onClear} className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600">
          <X size={13} /> Clear all
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <label className="text-xs text-slate-500">
          Genre
          <select className="input-field mt-1 text-xs" value={filters.genre ?? ''} onChange={(e) => set('genre', e.target.value || undefined)}>
            <option value="">All genres</option>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">
          Year from
          <input type="number" className="input-field mt-1 text-xs" placeholder="e.g. 2000" value={filters.year_from ?? ''}
            onChange={(e) => set('year_from', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="text-xs text-slate-500">
          Year to
          <input type="number" className="input-field mt-1 text-xs" placeholder="e.g. 2025" value={filters.year_to ?? ''}
            onChange={(e) => set('year_to', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="text-xs text-slate-500">
          Min rating
          <input type="number" min={0} max={10} step={0.5} className="input-field mt-1 text-xs" placeholder="0–10" value={filters.min_rating ?? ''}
            onChange={(e) => set('min_rating', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="text-xs text-slate-500">
          Min popularity
          <input type="number" min={0} className="input-field mt-1 text-xs" placeholder="e.g. 50" value={filters.min_popularity ?? ''}
            onChange={(e) => set('min_popularity', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="text-xs text-slate-500">
          Min runtime (min)
          <input type="number" min={0} className="input-field mt-1 text-xs" placeholder="e.g. 90" value={filters.min_runtime ?? ''}
            onChange={(e) => set('min_runtime', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="text-xs text-slate-500">
          Max runtime (min)
          <input type="number" min={0} className="input-field mt-1 text-xs" placeholder="e.g. 180" value={filters.max_runtime ?? ''}
            onChange={(e) => set('max_runtime', e.target.value ? Number(e.target.value) : undefined)} />
        </label>
        <label className="text-xs text-slate-500">
          Sort by
          <select className="input-field mt-1 text-xs" value={filters.sort ?? 'revenue'} onChange={(e) => set('sort', e.target.value)}>
            <option value="revenue">Revenue</option>
            <option value="budget">Budget</option>
            <option value="roi">ROI</option>
            <option value="vote_average">Rating</option>
            <option value="popularity">Popularity</option>
          </select>
        </label>
      </div>
    </div>
  )
}

function MovieGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="aspect-[2/3] w-full rounded-lg bg-slate-200" />
          <div className="mt-2 h-3 w-4/5 rounded bg-slate-200" />
          <div className="mt-1.5 h-2.5 w-2/5 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  )
}
