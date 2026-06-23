'use client'

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('FilmIQ error:', error) }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-200 bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-500" />
      </div>
      <h2 className="mb-3 text-2xl font-bold text-navy">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-slate-500">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button onClick={reset} className="btn-primary">Try Again</button>
    </div>
  )
}
