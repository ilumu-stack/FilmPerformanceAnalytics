'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

function passwordComplexityError(pw: string): string | null {
  if (pw.length < 8)              return 'At least 8 characters required'
  if (!/[A-Z]/.test(pw))         return 'Must contain an uppercase letter'
  if (!/[a-z]/.test(pw))         return 'Must contain a lowercase letter'
  if (!/\d/.test(pw))            return 'Must contain a digit'
  return null
}

export default function ChangePasswordPage() {
  const router             = useRouter()
  const { isAuthed }       = useAuthStore()
  const [form, setForm]    = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading] = useState(false)

  // Redirect unauthenticated users
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

    const complexityErr = passwordComplexityError(form.next)
    if (complexityErr) { toast.error(complexityErr); return }
    if (form.next !== form.confirm) { toast.error('New passwords do not match'); return }
    if (form.current === form.next)  { toast.error('New password must differ from current'); return }

    setLoading(true)
    try {
      await auth.changePassword(form.current, form.next)
      toast.success('Password changed successfully')
      setForm({ current: '', next: '', confirm: '' })
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="section-label mb-1">Account Security</p>
          <h1 className="font-display text-4xl tracking-widest">CHANGE PASSWORD</h1>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {([
              { key: 'current', label: 'Current Password',     placeholder: '••••••••' },
              { key: 'next',    label: 'New Password',          placeholder: 'Min 8 chars, upper, lower, digit' },
              { key: 'confirm', label: 'Confirm New Password',  placeholder: '••••••••' },
            ] as const).map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
                  {label}
                </label>
                <input
                  type="password"
                  required
                  className="input-field"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={set(key)}
                />
              </div>
            ))}

            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-gray-500">
              Requirements: 8+ characters · uppercase · lowercase · digit
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">
              {loading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
