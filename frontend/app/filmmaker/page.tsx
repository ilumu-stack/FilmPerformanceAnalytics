'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'
import { dataPortalApi, type Submission, type ActivityEntry, type PortalStats, type ValidationResult } from '@/lib/api'
import toast from 'react-hot-toast'
import { Plus, Database, Clock3, CheckCircle2, Cog } from 'lucide-react'
import SubmissionTable from '@/components/data-portal/SubmissionTable'
import ActivityFeed from '@/components/data-portal/ActivityFeed'
import ValidationPanel from '@/components/data-portal/ValidationPanel'

const CONTRIBUTOR_ROLES = [
  'filmmaker', 'producer', 'distributor', 'cinema_operator',
  'research_partner', 'studio_analyst', 'investor', 'admin',
]

type FilterTab = 'all' | 'pending' | 'approved' | 'processed' | 'rejected' | 'draft'

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: 'All' },
  { key: 'pending',   label: 'Pending Review' },
  { key: 'approved',  label: 'Approved' },
  { key: 'processed', label: 'Processed' },
  { key: 'rejected',  label: 'Rejected' },
  { key: 'draft',     label: 'Draft' },
]

function matchesTab(s: Submission, tab: FilterTab): boolean {
  if (tab === 'all') return true
  if (tab === 'pending') return s.status === 'submitted' || s.status === 'under_review'
  return s.status === tab
}

export default function DataPortalPage() {
  const router             = useRouter()
  const { user, isAuthed } = useAuthStore()

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [activity,    setActivity]    = useState<ActivityEntry[]>([])
  const [stats,       setStats]       = useState<PortalStats | null>(null)
  const [validation,  setValidation]  = useState<ValidationResult | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [filterTab,   setFilterTab]   = useState<FilterTab>('all')

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    const hydrated = useAuthStore.getState()._hydrated
    const check = (state: ReturnType<typeof useAuthStore.getState>) => {
      if (!state.isAuthed) { router.replace('/auth/login'); return }
      if (!CONTRIBUTOR_ROLES.includes(state.user?.role ?? '')) {
        router.replace('/dashboard')
      }
    }
    if (!hydrated) {
      const unsub = useAuthStore.subscribe((state) => {
        if (state._hydrated) { unsub(); check(state) }
      })
      return unsub
    }
    check(useAuthStore.getState())
  }, [router])

  useEffect(() => {
    if (!isAuthed) return
    void loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed])

  async function loadAll() {
    setLoading(true)
    try {
      const [subs, act, st] = await Promise.all([
        dataPortalApi.listSubmissions(),
        dataPortalApi.getActivity(8),
        dataPortalApi.getStats(),
      ])
      setSubmissions(subs)
      setActivity(act)
      setStats(st)

      const withIssues = subs.find((s) => s.status === 'submitted' || s.status === 'under_review')
      if (withIssues) {
        const detail = await dataPortalApi.getSubmission(withIssues.id)
        setValidation(detail.validation)
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load data portal')
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = user?.role === 'admin'
  const filteredSubmissions = useMemo(
    () => submissions.filter((s) => matchesTab(s, filterTab)),
    [submissions, filterTab],
  )
  const tabCount = (tab: FilterTab) => submissions.filter((s) => matchesTab(s, tab)).length

  return (
    <div className="min-h-screen px-8 py-8">
      {/* Header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="section-label mb-1">Analytics Pipeline</p>
          <h1 className="text-4xl font-bold text-navy">Data Portal</h1>
          <p className="mt-1 text-sm text-slate-400">
            {submissions.length} submission{submissions.length !== 1 ? 's' : ''} · {user?.username}
            {isAdmin && <span className="ml-2 font-medium text-brand">· Admin view (all submissions)</span>}
          </p>
        </div>
        <Link href="/filmmaker/submit" className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          New Submission
        </Link>
      </div>

      {/* Stat cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Database size={18} />}     label="Datasets Submitted" value={stats?.datasets_submitted ?? 0} onClick={() => setFilterTab('all')} />
        <StatCard icon={<Clock3 size={18} />}        label="Pending Review"     value={stats?.pending_review ?? 0}     onClick={() => setFilterTab('pending')} active={filterTab === 'pending'} />
        <StatCard icon={<CheckCircle2 size={18} />}  label="Approved"           value={stats?.approved ?? 0}           onClick={() => setFilterTab('approved')} active={filterTab === 'approved'} />
        <StatCard icon={<Cog size={18} />}           label="Processed"          value={stats?.processed ?? 0}          onClick={() => setFilterTab('processed')} active={filterTab === 'processed'} />
      </div>

      {loading ? (
        <div className="card p-12 text-center">
          <div className="text-lg font-semibold text-navy">Loading data portal…</div>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy">
                {filterTab === 'all' ? 'Recent Submissions' : `Submissions · ${FILTER_TABS.find((t) => t.key === filterTab)?.label}`}
              </h2>
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilterTab(tab.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    filterTab === tab.key
                      ? 'border-brand bg-brand text-white'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {tab.label} ({tabCount(tab.key)})
                </button>
              ))}
            </div>
            <SubmissionTable submissions={filterTab === 'all' ? filteredSubmissions.slice(0, 10) : filteredSubmissions} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ValidationPanel validation={validation} />
            <ActivityFeed activity={activity} />
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ icon, label, value, onClick, active }: {
  icon: React.ReactNode; label: string; value: number; onClick?: () => void; active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`card flex items-center gap-3 p-4 text-left transition-colors ${onClick ? 'hover:bg-slate-50' : ''} ${active ? 'ring-2 ring-brand' : ''}`}
    >
      <div className="rounded-lg bg-brand-50 p-2 text-brand">{icon}</div>
      <div>
        <div className="text-2xl font-bold text-navy">{value}</div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </button>
  )
}
