'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('FilmIQ error:', error) }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 font-display text-6xl tracking-widest text-red-400">ERROR</div>
      <h2 className="mb-3 text-xl font-semibold text-white">Something went wrong</h2>
      <p className="mb-6 max-w-md text-sm text-gray-500">
        {error.message || 'An unexpected error occurred. Please try again.'}
      </p>
      <button onClick={reset} className="btn-primary">Try Again</button>
    </div>
  )
}
