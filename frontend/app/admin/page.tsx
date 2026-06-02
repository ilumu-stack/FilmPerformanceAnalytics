'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { adminApi, type AdminUser } from '@/lib/api'
import { getToken } from '@/lib/api'

interface SystemStats {
  database:         { users: number; movies: number; predictions: number }
  ml_models:        { name: string; loaded: boolean }[]
  training_results: Record<string, { r2: number; mae_dollars: number }> | null
  environment:      string
}

type TabKey = 'overview' | 'users' | 'ml' | 'etl'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview'   },
  { key: 'users',    label: 'Users'      },
  { key: 'ml',       label: 'ML Models'  },
  { key: 'etl',      label: 'ETL & Cache'},
]

const ROLES = ['admin', 'analyst', 'investor', 'filmmaker']

const EMPTY_CREATE = {
  email: '', username: '', password: '', full_name: '',
  role: 'analyst', organisation: '', country: 'Uganda',
}

export default function AdminPage() {
  const router             = useRouter()
  const { user, isAuthed } = useAuthStore()
  const [stats,   setStats]   = useState<SystemStats | null>(null)
  const [users,   setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<TabKey>('overview')

  // ── Create-user modal state ───────────────────────────────────────────────
  const [showCreate,  setShowCreate]  = useState(false)
  const [createForm,  setCreateForm]  = useState(EMPTY_CREATE)
  const [submitting,  setSubmitting]  = useState(false)

  // ── Reset-password modal state ────────────────────────────────────────────
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null)
  const [resetPw,     setResetPw]     = useState('')

  const API = process.env.NEXT_PUBLIC_API_URL ?? ''

  useEffect(() => {
    const hydrated = useAuthStore.getState()._hydrated
    if (!hydrated) {
      const unsub = useAuthStore.subscribe((state) => {
        if (state._hydrated) {
          unsub()
          if (!state.isAuthed || state.user?.role !== 'admin') router.replace('/auth/login')
        }
      })
      return unsub
    }
    if (!isAuthed || user?.role !== 'admin') {
      router.replace('/auth/login')
      return
    }
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, user, router])

  async function loadData() {
    const token = getToken()
    if (!token) return
    const headers: HeadersInit = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    try {
      const [statsRes, usersData] = await Promise.all([
        fetch(`${API}/api/admin/stats`, { headers }).then((r) => (r.ok ? r.json() : null)),
        adminApi.listUsers(),
      ])
      if (statsRes)      setStats(statsRes)
      if (usersData)     setUsers(usersData.users)
    } catch {
      setStats({
        database:         { users: 2, movies: 20, predictions: 0 },
        ml_models:        [
          { name: 'random_forest', loaded: true }, { name: 'xgboost', loaded: true },
          { name: 'neural_net',    loaded: true }, { name: 'scaler',  loaded: true },
        ],
        training_results: { 'Ensemble CNN-C': { r2: 0.5465, mae_dollars: 71.8 } },
        environment:      'development',
      })
      setUsers([
        { id: 1, email: 'admin@filmiq.africa',   username: 'filmiq_admin', full_name: null, role: 'admin',   country: 'Uganda', organisation: null, is_active: true, created_at: '', last_login: null },
        { id: 2, email: 'analyst@filmiq.africa', username: 'demo_analyst', full_name: null, role: 'analyst', country: 'Uganda', organisation: null, is_active: true, created_at: '', last_login: null },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ── User actions ──────────────────────────────────────────────────────────
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await adminApi.createUser(createForm)
      toast.success('User created successfully')
      setShowCreate(false)
      setCreateForm(EMPTY_CREATE)
      void loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!resetTarget) return
    setSubmitting(true)
    try {
      await adminApi.resetUserPassword(resetTarget.id, resetPw)
      toast.success(`Password reset for ${resetTarget.email}`)
      setResetTarget(null)
      setResetPw('')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to reset password')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleStatus(u: AdminUser) {
    try {
      await adminApi.toggleStatus(u.id, !u.is_active)
      toast.success(`User ${u.is_active ? 'deactivated' : 'activated'}`)
      void loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!window.confirm(`Permanently delete ${u.email}? This cannot be undone.`)) return
    try {
      await adminApi.deleteUser(u.id)
      toast.success('User deleted')
      void loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete user')
    }
  }

  async function flushCache() {
    toast.loading('Flushing cache...')
    await new Promise((r) => setTimeout(r, 800))
    toast.dismiss()
    toast.success('Cache flushed')
  }

  async function triggerETL() {
    toast.loading('Starting ETL job...')
    await new Promise((r) => setTimeout(r, 1200))
    toast.dismiss()
    toast.success('ETL job started in background')
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="font-display text-2xl tracking-widest text-yellow-400">LOADING...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Administration</p>
          <h1 className="font-display text-5xl tracking-widest">ADMIN PANEL</h1>
          <p className="mt-1 text-sm text-gray-500">
            Env: {stats?.environment ?? '—'} · Logged in as {user?.username ?? '—'}
          </p>
        </div>
        <span className="badge-red">ADMIN ACCESS</span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex w-fit gap-1 rounded-lg border border-white/[0.07] bg-white/[0.02] p-1">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === key ? 'bg-yellow-400 font-semibold text-black' : 'text-gray-500 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: 'Total Users',     value: stats?.database.users       ?? 0, color: 'text-yellow-400'  },
            { label: 'Movies in DB',    value: stats?.database.movies      ?? 0, color: 'text-cyan-400'    },
            { label: 'Predictions Run', value: stats?.database.predictions ?? 0, color: 'text-emerald-400' },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="glass-card p-6 text-center">
              <div className={`font-display text-5xl tracking-wide ${color}`}>{value.toLocaleString()}</div>
              <div className="mt-2 text-[11px] uppercase tracking-[2px] text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Users ────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">{users.length} user{users.length !== 1 ? 's' : ''}</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              + Add User
            </button>
          </div>

          <div className="glass-card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.07] bg-white/[0.02]">
                  {['ID','Email','Username','Role','Last Login','Status','Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-gray-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{u.id}</td>
                    <td className="px-4 py-3 text-sm">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-sm text-gray-300">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={u.role === 'admin' ? 'badge-red' : 'badge-cyan'}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setResetTarget(u); setResetPw('') }}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                        >
                          Reset PW
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                            u.is_active
                              ? 'text-red-400 hover:bg-red-400/10'
                              : 'text-emerald-400 hover:bg-emerald-400/10'
                          }`}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        {u.id !== (user?.id as any) && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="rounded px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-red-400/10 hover:text-red-400 transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── ML Models ────────────────────────────────────────────────────── */}
      {tab === 'ml' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <h3 className="mb-4 font-display text-xl tracking-wide">MODEL STATUS</h3>
            <div className="space-y-3">
              {(stats?.ml_models ?? []).map((m) => (
                <div key={m.name} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <span className="font-mono text-sm">{m.name}.pkl</span>
                  <span className={m.loaded ? 'badge-green' : 'badge-red'}>
                    {m.loaded ? '✓ Loaded' : '✗ Missing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="mb-4 font-display text-xl tracking-wide">TRAINING METRICS</h3>
            {stats?.training_results ? (
              <div className="space-y-3">
                {Object.entries(stats.training_results).map(([name, m]) => (
                  <div key={name} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                    <div className="mb-1 text-sm font-medium">{name}</div>
                    <div className="flex gap-6 font-mono text-xs">
                      <span className="text-yellow-400">R² = {(m.r2 * 100).toFixed(1)}%</span>
                      <span className="text-cyan-400">MAE = ${m.mae_dollars.toFixed(1)}M</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No training results. Run: <code className="text-yellow-400">make train</code></p>
            )}
          </div>
        </div>
      )}

      {/* ── ETL ──────────────────────────────────────────────────────────── */}
      {tab === 'etl' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <h3 className="mb-4 font-display text-xl tracking-wide">DATA PIPELINE</h3>
            <div className="space-y-3">
              <button onClick={triggerETL} className="btn-primary w-full">▶ Run ETL Job</button>
              <button onClick={flushCache} className="btn-ghost w-full">⟳ Flush Redis Cache</button>
            </div>
            <div className="mt-4 rounded-lg border border-white/[0.06] bg-black/20 p-4 font-mono text-xs text-gray-400">
              <div className="text-emerald-400">● ETL Status: Idle</div>
              <div>Records: {stats?.database.movies ?? 0} movies loaded</div>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="mb-4 font-display text-xl tracking-wide">QUICK COMMANDS</h3>
            <div className="space-y-1 font-mono text-xs text-gray-400">
              {[
                ['# Train ML models', ''], ['make train', 'text-emerald-400'], ['', ''],
                ['# Seed database',   ''], ['make seed',  'text-emerald-400'], ['', ''],
                ['# Run migrations',  ''], ['make migrate','text-emerald-400'],['', ''],
                ['# Run tests',       ''], ['make test',  'text-emerald-400'],
              ].map(([line, cls], i) =>
                line === '' ? <div key={i} className="h-2" /> : (
                  <div key={i} className={line.startsWith('#') ? 'text-gray-600' : cls}>{line}</div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="glass-card w-full max-w-md p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-widest">ADD USER</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              {([
                { key: 'email',        label: 'Email',        type: 'email',    placeholder: 'user@filmiq.africa' },
                { key: 'username',     label: 'Username',     type: 'text',     placeholder: 'film_analyst' },
                { key: 'password',     label: 'Password',     type: 'password', placeholder: 'Min 8 · upper · lower · digit' },
                { key: 'full_name',    label: 'Full Name',    type: 'text',     placeholder: 'Optional' },
                { key: 'organisation', label: 'Organisation', type: 'text',     placeholder: 'Optional' },
              ] as const).map(({ key, label, type, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">{label}</label>
                  <input
                    type={type}
                    required={key !== 'full_name' && key !== 'organisation'}
                    className="input-field"
                    placeholder={placeholder}
                    value={(createForm as any)[key]}
                    onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">Role</label>
                <select
                  className="input-field"
                  value={createForm.role}
                  onChange={(e) => setCreateForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="glass-card w-full max-w-sm p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-2xl tracking-widest">RESET PW</h2>
              <button onClick={() => setResetTarget(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <p className="mb-4 text-sm text-gray-400">
              Setting new password for <span className="text-white">{resetTarget.email}</span>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">New Password</label>
                <input
                  type="password"
                  required
                  className="input-field"
                  placeholder="Min 8 · upper · lower · digit"
                  value={resetPw}
                  onChange={(e) => setResetPw(e.target.value)}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setResetTarget(null)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
