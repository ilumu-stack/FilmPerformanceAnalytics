'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Eye, EyeOff, Mail, Lock, AlertCircle,
  Film, Loader2, ShieldCheck,
} from 'lucide-react'
import {
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth'
import toast from 'react-hot-toast'
import { firebaseAuth } from '@/lib/firebase'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

// ── Firebase error → human-readable message ────────────────────────────────
const FIREBASE_ERRORS: Record<string, string> = {
  'auth/user-not-found':         'No account found with this email address.',
  'auth/wrong-password':         'Incorrect password. Please try again.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/user-disabled':          'This account has been disabled. Contact your administrator.',
  'auth/too-many-requests':      'Too many failed attempts. Please wait a moment and try again.',
  'auth/invalid-credential':     'Invalid email or password.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/operation-not-allowed':  'Email / password sign-in is not enabled. Contact support.',
}

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Authentication failed. Please try again.'
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

// ── Main form ──────────────────────────────────────────────────────────────
function LoginForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { login }    = useAuthStore()

  const [email,           setEmail]           = useState('')
  const [password,        setPassword]        = useState('')
  const [showPw,          setShowPw]          = useState(false)
  const [rememberMe,      setRememberMe]      = useState(true)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [emailTouched,    setEmailTouched]    = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const emailFieldError =
    emailTouched && email.length > 0 && !isValidEmail(email)
      ? 'Please enter a valid email address.'
      : null
  const passwordFieldError =
    passwordTouched && !password ? 'Password is required.' : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setEmailTouched(true)
    setPasswordTouched(true)
    setError(null)

    if (!email || !password || !isValidEmail(email)) return

    setLoading(true)
    try {
      await setPersistence(
        firebaseAuth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence,
      )

      await signInWithEmailAndPassword(firebaseAuth, email, password)

      let res
      try {
        res = await auth.login(email, password)
      } catch (backendErr) {
        await signOut(firebaseAuth)
        throw new Error(
          backendErr instanceof Error
            ? backendErr.message
            : 'Unable to connect to the analytics server. Please try again.',
        )
      }

      login(res.user, res.access_token, res.refresh_token, res.must_change_password)

      if (res.must_change_password) {
        router.push('/auth/change-password')
        return
      }

      toast.success(`Welcome back, ${res.user.username}!`)
      const next = searchParams.get('next')
      router.push(next && next.startsWith('/') ? next : '/dashboard')
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as { code: string }).code
        if (code.startsWith('auth/')) {
          setError(getFirebaseError(code))
          return
        }
      }
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center bg-filmiq-bg2 px-4 py-16">
      <div className="w-full max-w-[440px]">

        {/* ── Logo ── */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="mb-8 text-center"
        >
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-navy">FilmIQ</span>
          </div>
          <p className="text-[11px] uppercase tracking-[3px] text-slate-400">
            Uganda's Cinema Intelligence Platform
          </p>
        </motion.div>

        {/* ── Card ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.07, ease: 'easeOut' }}
          className="card p-8"
        >
          {/* Top accent line */}
          <div className="absolute inset-x-0 top-0 h-[3px] rounded-t-xl bg-gradient-to-r from-brand to-brand-light" />

          <div className="mb-7">
            <p className="section-label mb-1.5">Welcome back</p>
            <h1 className="text-2xl font-bold text-navy">Sign in to your account</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
              Enter your credentials to access the analytics platform.
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">
                Email Address <span className="text-brand">*</span>
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="analyst@filmiq.africa"
                  aria-invalid={!!emailFieldError}
                  aria-describedby={emailFieldError ? 'email-err' : undefined}
                  className={`input-field pl-10 ${
                    emailFieldError ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''
                  }`}
                />
              </div>
              <AnimatePresence>
                {emailFieldError && (
                  <motion.p
                    id="email-err"
                    role="alert"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="flex items-center gap-1.5 text-[11px] text-red-500"
                  >
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {emailFieldError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">
                Password <span className="text-brand">*</span>
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(null) }}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="••••••••"
                  aria-invalid={!!passwordFieldError}
                  aria-describedby={passwordFieldError ? 'pw-err' : undefined}
                  className={`input-field pl-10 pr-11 ${
                    passwordFieldError ? 'border-red-400 focus:border-red-400 focus:ring-red-100' : ''
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition-colors hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <AnimatePresence>
                {passwordFieldError && (
                  <motion.p
                    id="pw-err"
                    role="alert"
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginTop: 6 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    className="flex items-center gap-1.5 text-[11px] text-red-500"
                  >
                    <AlertCircle className="h-3 w-3 flex-shrink-0" />
                    {passwordFieldError}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Remember me + Forgot password */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer select-none items-center gap-2">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="peer sr-only"
                    aria-label="Remember me"
                  />
                  <div className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white transition-colors peer-checked:border-brand peer-checked:bg-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                    <AnimatePresence>
                      {rememberMe && (
                        <motion.svg
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          viewBox="0 0 12 12"
                          className="h-2.5 w-2.5 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="2 6 5 9 10 3" />
                        </motion.svg>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
                <span className="text-[12px] text-slate-500">Remember me</span>
              </label>

              <Link
                href="/auth/forgot-password"
                className="text-[12px] font-medium text-brand transition-colors hover:text-brand-dark focus:outline-none focus-visible:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Auth error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                  <p className="text-[13px] leading-relaxed text-red-600">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={loading ? {} : { scale: 0.985 }}
              className="btn-primary w-full py-3 text-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </motion.button>
          </form>

          <div className="mt-6 border-t border-slate-100 pt-5 text-center text-[12px] text-slate-400">
            No account?{' '}
            <span className="font-medium text-slate-600">Contact your administrator to get access.</span>
          </div>
        </motion.div>

        {/* Security badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
          Protected by Firebase Authentication · Enterprise Security
        </motion.div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
