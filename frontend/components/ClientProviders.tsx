'use client'

import { useEffect } from 'react'
import { Toaster } from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuthStore } from '@/lib/store'
import { FirebaseAuthProvider, useFirebaseAuth } from '@/lib/auth-context'

function AppLoadingScreen() {
  return (
    <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-filmiq-bg">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/3 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/[0.04] blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-cyan-500/[0.03] blur-3xl" />
      </div>

      <div className="relative text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="font-display text-[68px] leading-none tracking-[10px] text-yellow-400">
            FILMIQ
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-[5px] text-gray-600">
            Film Data Analytics
          </div>
        </motion.div>

        {/* Pulsing dots */}
        <div className="mt-10 flex items-center justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-yellow-500/60"
              animate={{ opacity: [0.25, 1, 0.25], scale: [0.75, 1, 0.75] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Renders the loading screen while Firebase checks the initial auth state.
 * Once auth status is known (< ~1 s), the app fades in.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { authLoading } = useFirebaseAuth()

  return (
    <AnimatePresence mode="wait">
      {authLoading ? (
        <motion.div key="loading" exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          <AppLoadingScreen />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function ClientProviders({ children }: { children: React.ReactNode }) {
  // Manually rehydrate after mount — prevents Next.js SSR hydration mismatch
  useEffect(() => {
    useAuthStore.persist.rehydrate()
    useAuthStore.getState().setHydrated()
  }, [])

  return (
    <FirebaseAuthProvider>
      <AuthGate>{children}</AuthGate>
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
    </FirebaseAuthProvider>
  )
}
