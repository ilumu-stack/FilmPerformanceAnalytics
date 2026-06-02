'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { auth } from '@/lib/api'
import { useAuthStore } from '@/lib/store'

export default function LoginPage() {
  const router = useRouter()
  const login  = useAuthStore((s) => s.login)
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await auth.login(email, password)
      login(res.user, res.access_token, res.refresh_token)
      toast.success(`Welcome back, ${res.user.username}!`)
      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-88px)] items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display text-5xl tracking-widest text-yellow-400">FILMIQ</h1>
          <p className="mt-2 text-sm text-gray-500">Sign in to your analytics account</p>
        </div>

        <div className="glass-card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
                Email
              </label>
              <input
                type="email" required
                className="input-field"
                placeholder="analyst@filmiq.africa"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
                Password
              </label>
              <input
                type="password" required
                className="input-field"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 border-t border-white/[0.07] pt-5 text-center text-xs text-gray-500">
            Demo credentials: <span className="text-gray-300">analyst@filmiq.africa / demo1234</span>
          </div>

          <p className="mt-4 text-center text-xs text-gray-500">
            No account? Contact an administrator.
          </p>
        </div>
      </div>
    </div>
  )
}
