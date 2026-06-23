'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useMemo } from 'react'
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
  { key: 'overview', label: 'Overview'    },
  { key: 'users',    label: 'Users'       },
  { key: 'ml',       label: 'ML Models'   },
  { key: 'etl',      label: 'ETL & Cache' },
]

const ROLES = ['admin', 'analyst', 'investor', 'filmmaker']

const EMPTY_CREATE = {
  email: '', username: '', password: '', full_name: '',
  role: 'analyst', organisation: '', country: 'Uganda',
}

const EMPTY_EDIT = {
  full_name: '', username: '', organisation: '', country: '',
}

export default function AdminPage() {
  const router             = useRouter()
  const { user, isAuthed } = useAuthStore()
  const [stats,   setStats]   = useState<SystemStats | null>(null)
  const [users,   setUsers]   = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<TabKey>('overview')

  // ── Search / filter state ─────────────────────────────────────────────────
  const [search,      setSearch]      = useState('')
  const [roleFilter,  setRoleFilter]  = useState('')
  const [statusFilter,setStatusFilter]= useState('')
  const [page,        setPage]        = useState(1)
  const PAGE_SIZE = 10

  // ── Create-user modal state ───────────────────────────────────────────────
  const [showCreate,  setShowCreate]  = useState(false)
  const [createForm,  setCreateForm]  = useState(EMPTY_CREATE)
  const [submitting,  setSubmitting]  = useState(false)

  // ── Edit-user modal state ─────────────────────────────────────────────────
  const [editTarget,  setEditTarget]  = useState<AdminUser | null>(null)
  const [editForm,    setEditForm]    = useState(EMPTY_EDIT)

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
        adminApi.listUsers(1, 200),
      ])
      if (statsRes)  setStats(statsRes)
      if (usersData) setUsers(usersData.users)
    } catch {
      setStats({
        database:         { users: 2, movies: 20, predictions: 0 },
        ml_models: [
          { name: 'random_forest', loaded: true }, { name: 'xgboost',      loaded: true },
          { name: 'neural_net',    loaded: true }, { name: 'scaler',       loaded: true },
        ],
        training_results: { 'Ensemble CNN-C': { r2: 0.5465, mae_dollars: 71.8 } },
        environment:      'development',
      })
      setUsers([
        { id: '1', email: 'admin@filmiq.africa',   username: 'filmiq_admin', full_name: null, role: 'admin',     country: 'Uganda', organisation: null, is_active: true, must_change_password: false, created_at: '', last_login: null },
        { id: '2', email: 'analyst@filmiq.africa', username: 'demo_analyst', full_name: null, role: 'analyst',   country: 'Uganda', organisation: null, is_active: true, must_change_password: false, created_at: '', last_login: null },
      ])
    } finally {
      setLoading(false)
    }
  }

  // ── Filtered + paginated users ────────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase()
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.username ?? '').toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q)
      const matchesRole   = !roleFilter   || u.role === roleFilter
      const matchesStatus =
        !statusFilter ||
        (statusFilter === 'active'   &&  u.is_active) ||
        (statusFilter === 'inactive' && !u.is_active)
      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const totalPages   = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const currentPage  = Math.min(page, totalPages)
  const pagedUsers   = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, roleFilter, statusFilter])

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

  function openEdit(u: AdminUser) {
    setEditTarget(u)
    setEditForm({
      full_name:    u.full_name    ?? '',
      username:     u.username     ?? '',
      organisation: u.organisation ?? '',
      country:      u.country      ?? '',
    })
  }

  async function handleEditUser(e: React.FormEvent) {
    e.preventDefault()
    if (!editTarget) return
    setSubmitting(true)
    try {
      await adminApi.editUser(editTarget.id, {
        full_name:    editForm.full_name    || undefined,
        username:     editForm.username     || undefined,
        organisation: editForm.organisation || undefined,
        country:      editForm.country      || undefined,
      })
      toast.success('User updated')
      setEditTarget(null)
      void loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRoleChange(u: AdminUser, newRole: string) {
    try {
      await adminApi.changeRole(u.id, newRole)
      toast.success(`Role updated to ${newRole}`)
      void loadData()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change role')
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
    const token = getToken()
    if (!token) return
    toast.loading('Flushing cache…')
    try {
      await fetch(`${API}/api/admin/cache`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.dismiss()
      toast.success('Cache flushed')
    } catch {
      toast.dismiss()
      toast.error('Cache flush failed')
    }
  }

  async function triggerETL() {
    const token = getToken()
    if (!token) return
    toast.loading('Starting ETL job…')
    try {
      await fetch(`${API}/api/admin/etl/run`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      toast.dismiss()
      toast.success('ETL job started in background')
    } catch {
      toast.dismiss()
      toast.error('ETL trigger failed')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-xl font-bold text-navy">Loading Admin Panel…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-8 py-8">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Administration</p>
          <h1 className="text-4xl font-bold text-navy">Admin Panel</h1>
          <p className="mt-1 text-sm text-slate-400">
            Env: {stats?.environment ?? '—'} · Logged in as {user?.username ?? '—'}
          </p>
        </div>
        <span className="badge-red">ADMIN ACCESS</span>
      </div>

      {/* Tabs */}
      <div className="tab-bar mb-6">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={tab === key ? 'tab-item-active' : 'tab-item'}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-3 gap-4">
          {([
            { label: 'Total Users',     value: stats?.database.users       ?? 0, color: 'text-brand'        },
            { label: 'Movies in DB',    value: stats?.database.movies      ?? 0, color: 'text-emerald-600'  },
            { label: 'Predictions Run', value: stats?.database.predictions ?? 0, color: 'text-purple-600'   },
          ] as const).map(({ label, value, color }) => (
            <div key={label} className="card p-8 text-center">
              <div className={`text-5xl font-bold ${color}`}>{value.toLocaleString()}</div>
              <div className="mt-2 text-[11px] uppercase tracking-[2px] text-slate-400">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Users ────────────────────────────────────────────────────────── */}
      {tab === 'users' && (
        <>
          {/* Toolbar */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Search by email, username or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field h-9 w-72 text-sm"
            />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field h-9 text-sm"
            >
              <option value="">All Roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field h-9 text-sm"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <span className="ml-auto text-sm text-slate-400">
              {filteredUsers.length} of {users.length} user{users.length !== 1 ? 's' : ''}
            </span>
            <button onClick={() => setShowCreate(true)} className="btn-primary h-9">
              + Add User
            </button>
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {['Email', 'Username', 'Full Name', 'Role', 'Country', 'Last Login', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      No users match your filters.
                    </td>
                  </tr>
                ) : pagedUsers.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-700">{u.email}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{u.username}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u, e.target.value)}
                        className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold bg-white cursor-pointer transition-colors ${
                          u.role === 'admin'
                            ? 'border-red-200 text-red-600'
                            : u.role === 'filmmaker'
                            ? 'border-purple-200 text-purple-600'
                            : u.role === 'investor'
                            ? 'border-emerald-200 text-emerald-600'
                            : 'border-blue-200 text-blue-600'
                        }`}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{u.country ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openEdit(u)}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand-50 transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => { setResetTarget(u); setResetPw('') }}
                          className="rounded px-2 py-1 text-[11px] font-semibold text-purple-600 hover:bg-purple-50 transition-colors"
                        >
                          Reset PW
                        </button>
                        <button
                          onClick={() => handleToggleStatus(u)}
                          className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                            u.is_active
                              ? 'text-red-600 hover:bg-red-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                        {u.id !== (user?.id as any) && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="rounded px-2 py-1 text-[11px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                >
                  ‹ Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => Math.abs(p - currentPage) <= 2)
                  .map((p) => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`rounded-md border px-3 py-1.5 text-xs transition-colors ${
                        p === currentPage
                          ? 'border-brand bg-brand-50 text-brand font-semibold'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-30 transition-colors"
                >
                  Next ›
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ML Models ────────────────────────────────────────────────────── */}
      {tab === 'ml' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-navy">Model Status</h3>
            <div className="space-y-3">
              {(stats?.ml_models ?? []).map((m) => (
                <div key={m.name} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="font-mono text-sm text-slate-700">{m.name}.pkl</span>
                  <span className={m.loaded ? 'badge-green' : 'badge-red'}>
                    {m.loaded ? '✓ Loaded' : '✗ Missing'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-navy">Training Metrics</h3>
            {stats?.training_results ? (
              <div className="space-y-3">
                {Object.entries(stats.training_results).map(([name, m]) => (
                  <div key={name} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="mb-2 text-sm font-semibold text-slate-700">{name}</div>
                    <div className="flex gap-6 font-mono text-xs">
                      <span className="text-brand font-semibold">R² = {(m.r2 * 100).toFixed(1)}%</span>
                      <span className="text-emerald-600 font-semibold">MAE = ${m.mae_dollars.toFixed(1)}M</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No training results. Run: <code className="font-mono text-brand">make train</code></p>
            )}
          </div>
        </div>
      )}

      {/* ── ETL ──────────────────────────────────────────────────────────── */}
      {tab === 'etl' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-navy">Data Pipeline</h3>
            <div className="space-y-3">
              <button onClick={triggerETL} className="btn-primary w-full">▶ Run ETL Job</button>
              <button onClick={flushCache} className="btn-ghost w-full">⟳ Flush Redis Cache</button>
            </div>
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-xs text-slate-500">
              <div className="text-emerald-600 font-semibold">● ETL Status: Idle</div>
              <div className="mt-1">Records: {stats?.database.movies ?? 0} movies loaded</div>
            </div>
          </div>
          <div className="card p-6">
            <h3 className="mb-4 text-lg font-semibold text-navy">Quick Commands</h3>
            <div className="space-y-1 rounded-lg bg-slate-50 p-4 font-mono text-xs text-slate-500 border border-slate-200">
              {[
                ['# Train ML models', ''], ['make train',   'text-brand'], ['', ''],
                ['# Seed database',   ''], ['make seed',    'text-brand'], ['', ''],
                ['# Run migrations',  ''], ['make migrate', 'text-brand'], ['', ''],
                ['# Run tests',       ''], ['make test',    'text-brand'],
              ].map(([line, cls], i) =>
                line === '' ? <div key={i} className="h-2" /> : (
                  <div key={i} className={line.startsWith('#') ? 'text-slate-400' : cls}>{line}</div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/60 px-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy">Add User</h2>
              <button onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-600 text-xl transition-colors">✕</button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-4">
              {([
                { key: 'email',        label: 'Email',        type: 'email',    placeholder: 'user@filmiq.africa', required: true  },
                { key: 'username',     label: 'Username',     type: 'text',     placeholder: 'film_analyst',       required: true  },
                { key: 'password',     label: 'Password',     type: 'password', placeholder: 'Min 8 · upper · lower · digit', required: true },
                { key: 'full_name',    label: 'Full Name',    type: 'text',     placeholder: 'Optional',           required: false },
                { key: 'organisation', label: 'Organisation', type: 'text',     placeholder: 'Optional',           required: false },
                { key: 'country',      label: 'Country',      type: 'text',     placeholder: 'Uganda',             required: false },
              ] as const).map(({ key, label, type, placeholder, required }) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">{label}</label>
                  <input
                    type={type}
                    required={required}
                    className="input-field"
                    placeholder={placeholder}
                    value={(createForm as any)[key]}
                    onChange={(e) => setCreateForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">Role</label>
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

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/60 px-4 backdrop-blur-sm">
          <div className="card w-full max-w-md p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy">Edit User</h2>
              <button onClick={() => setEditTarget(null)} className="text-slate-400 hover:text-slate-600 text-xl transition-colors">✕</button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Editing <span className="font-semibold text-slate-700">{editTarget.email}</span>
            </p>
            <form onSubmit={handleEditUser} className="space-y-4">
              {([
                { key: 'full_name',    label: 'Full Name',    placeholder: 'Full name'    },
                { key: 'username',     label: 'Username',     placeholder: 'Username'     },
                { key: 'organisation', label: 'Organisation', placeholder: 'Organisation' },
                { key: 'country',      label: 'Country',      placeholder: 'Country'      },
              ] as const).map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">{label}</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder={placeholder}
                    value={(editForm as any)[key]}
                    onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditTarget(null)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ──────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-800/60 px-4 backdrop-blur-sm">
          <div className="card w-full max-w-sm p-8">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-navy">Reset Password</h2>
              <button onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-600 text-xl transition-colors">✕</button>
            </div>
            <p className="mb-4 text-sm text-slate-400">
              Setting new password for <span className="font-semibold text-slate-700">{resetTarget.email}</span>
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[2px] text-slate-500">New Password</label>
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
