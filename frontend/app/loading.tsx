import { Film } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy">
          <Film className="h-4 w-4 text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight text-navy">FilmIQ</span>
      </div>
      <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full w-2/3 animate-pulse rounded-full bg-brand" />
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[3px] text-slate-400">Loading…</p>
    </div>
  )
}
