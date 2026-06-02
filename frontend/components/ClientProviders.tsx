'use client'

import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'

/**
 * ClientProviders wraps client-only concerns:
 * 1. Zustand auth rehydration (must happen client-side only to avoid SSR mismatch)
 * 2. react-hot-toast Toaster
 */
export function ClientProviders({ children }: { children: React.ReactNode }) {
  // Manually rehydrate after mount — prevents Next.js SSR hydration mismatch
  useEffect(() => {
    useAuthStore.persist.rehydrate()
    useAuthStore.getState().setHydrated()
  }, [])

  return (
    <>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#111528',
            color:      '#e8eaf0',
            border:     '1px solid rgba(255,255,255,0.08)',
          },
          success: { iconTheme: { primary: '#22d49a', secondary: '#111528' } },
          error:   { iconTheme: { primary: '#f05068', secondary: '#111528' } },
        }}
      />
    </>
  )
}
