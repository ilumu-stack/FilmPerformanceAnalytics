'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Film, Lock, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

function passwordError(pw: string): string | null {
  if (pw.length < 8)      return 'At least 8 characters required'
  if (!/[A-Z]/.test(pw))  return 'Must contain an uppercase letter'
  if (!/[a-z]/.test(pw))  return 'Must contain a lowercase letter'
  if (!/\d/.test(pw))     return 'Must contain a digit'
  return null
}

export default function ChangePasswordPage() {
  const router                              = useRouter()
  const { isAuthed, mustChangePw, updateTokens } = useAuthStore()
  const [form, setForm]                     = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading]               = useState(false)

  useEffect(() => {
    const hydrated = useAuthStore.getState()._hydrated
    if (!hydrated) {
      const unsub = useAuthStore.subscribe((state) => {
        if (state._hydrated) {
          unsub()
          if (!state.isAuthed) router.replace('/auth/login')
        }
      })
      return unsub
    }
    if (!isAuthed) router.replace('/auth/login')
  }, [isAuthed, router])

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const complexityErr = passwordError(form.next)
    if (complexityErr)              { toast.error(complexityErr); return }
    if (form.next !== form.confirm) { toast.error('New passwords do not match'); return }
    if (form.current === form.next) { toast.error('New password must differ from current password'); return }

    setLoading(true)
    try {
      const res = await auth.changePassword(form.current, form.next)
      updateTokens(res.access_token, res.refresh_token)
      toast.success('Password changed successfully')
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-68px)] items-center justify-center bg-filmiq-bg2 px-4 py-16">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mb-3 flex items-center justify-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy">
              <Film className="h-5 w-5 text-white" />
            </div>
            <span className="text-3xl font-bold tracking-tight text-navy">FilmIQ</span>
          </div>
          <p className="text-[11px] uppercase tracking-[3px] text-slate-400">
            Uganda's Cinema Intelligence Platform
          </p>
        </div>

        {mustChangePw && (
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" />
            <p className="text-sm text-amber-700">
              You are using a temporary password. You must set a new password before continuing.
            </p>
          </div>
        )}

        <div className="relative card overflow-hidden p-8">
          {/* Top accent */}
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-brand to-brand-light" />

          <div className="mb-7">
            <p className="section-label mb-1.5">Account Security</p>
            <h1 className="text-2xl font-bold text-navy">
              {mustChangePw ? 'Set New Password' : 'Change Password'}
            </h1>
            <p className="mt-1.5 text-[13px] text-slate-400">
              Choose a strong password with at least 8 characters.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {([
              { key: 'current', label: mustChangePw ? 'Temporary Password'  : 'Current Password',   auto: 'current-password', ph: '••••••••' },
              { key: 'next',    label: 'New Password',                                               auto: 'new-password',     ph: 'Min 8 · upper · lower · digit' },
              { key: 'confirm', label: 'Confirm New Password',                                       auto: 'new-password',     ph: '••••••••' },
            ] as const).map(({ key, label, auto, ph }) => (
              <div key={key}>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">
                  {label}
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    autoComplete={auto}
                    className="input-field pl-10"
                    placeholder={ph}
                    value={form[key]}
                    onChange={set(key)}
                  />
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
              Requirements: 8+ characters · uppercase · lowercase · digit
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary mt-2 w-full py-3 text-sm"
            >
              {loading ? 'Updating…' : mustChangePw ? 'Set Password & Continue' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
