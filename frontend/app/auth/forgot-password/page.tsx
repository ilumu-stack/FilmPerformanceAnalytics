'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, ArrowLeft, CheckCircle, AlertCircle,
  Loader2, Film, ShieldCheck,
} from 'lucide-react'
import { sendPasswordResetEmail } from 'firebase/auth'
import { firebaseAuth } from '@/lib/firebase'

const FIREBASE_ERRORS: Record<string, string> = {
  'auth/user-not-found':         'No account found with this email address.',
  'auth/invalid-email':          'Please enter a valid email address.',
  'auth/too-many-requests':      'Too many requests. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Please check your connection.',
}

function getFirebaseError(code: string): string {
  return FIREBASE_ERRORS[code] ?? 'Failed to send reset email. Please try again.'
}

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await sendPasswordResetEmail(firebaseAuth, email)
      setSent(true)
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err) {
        setError(getFirebaseError((err as { code: string }).code))
      } else {
        setError('Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center bg-filmiq-bg2 px-4 py-16">
      <div className="w-full max-w-[440px]">

        {/* Logo */}
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

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.07, ease: 'easeOut' }}
          className="relative card overflow-hidden p-8"
        >
          {/* Top accent */}
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand to-brand-light" />

          <AnimatePresence mode="wait">

            {/* ── Success state ── */}
            {sent ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="py-4 text-center"
              >
                <div className="mb-5 flex justify-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
                    className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50"
                  >
                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                  </motion.div>
                </div>

                <h2 className="mb-2 text-xl font-bold text-navy">Check your inbox</h2>
                <p className="mb-1 text-[13px] text-slate-500">
                  A password reset link has been sent to
                </p>
                <p className="mb-5 break-all text-[13px] font-semibold text-brand">{email}</p>
                <p className="mb-7 text-[12px] leading-relaxed text-slate-400">
                  Didn&apos;t receive it? Check your spam or junk folder. The link expires in 1 hour.
                </p>

                <Link href="/auth/login" className="btn-primary inline-flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Link>

                <p className="mt-5 text-[12px] text-slate-400">
                  Still having trouble?{' '}
                  <button
                    onClick={() => { setSent(false); setError(null) }}
                    className="font-medium text-brand underline underline-offset-2 hover:text-brand-dark"
                  >
                    Try again
                  </button>
                </p>
              </motion.div>

            ) : (

              /* ── Form state ── */
              <motion.div key="form">
                <Link
                  href="/auth/login"
                  className="mb-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-500 transition-colors hover:text-navy focus:outline-none focus-visible:underline"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Sign In
                </Link>

                <div className="mb-7">
                  <p className="section-label mb-1.5">Account Recovery</p>
                  <h1 className="text-2xl font-bold text-navy">Reset your password</h1>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                    Enter the email address associated with your account and we&apos;ll send you a
                    secure reset link.
                  </p>
                </div>

                <form onSubmit={handleSubmit} noValidate className="space-y-5">
                  <div>
                    <label
                      htmlFor="reset-email"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500"
                    >
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        id="reset-email"
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setError(null) }}
                        placeholder="analyst@filmiq.africa"
                        className="input-field pl-10"
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        role="alert"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3.5"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                        <p className="text-[13px] leading-relaxed text-red-600">{error}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading || !email}
                    whileTap={loading ? {} : { scale: 0.985 }}
                    className="btn-primary w-full py-3 text-sm"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending…
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Security badge */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 flex items-center justify-center gap-2 text-[11px] text-slate-400"
        >
          <ShieldCheck className="h-3.5 w-3.5" />
          Protected by Firebase Authentication · Enterprise Security
        </motion.div>
      </div>
    </div>
  )
}
