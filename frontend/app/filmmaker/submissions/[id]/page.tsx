'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ChevronLeft, Check, X } from 'lucide-react'
import { useAuthStore } from '@/lib/store'
import { dataPortalApi, type SubmissionDetail } from '@/lib/api'
import StatusBadge from '@/components/data-portal/StatusBadge'
import ValidationPanel from '@/components/data-portal/ValidationPanel'

export default function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isAuthed } = useAuthStore()

  const [detail, setDetail] = useState<SubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  useEffect(() => {
    if (!isAuthed) { router.replace('/auth/login'); return }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, id])

  async function load() {
    setLoading(true)
    try {
      setDetail(await dataPortalApi.getSubmission(id))
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load submission')
    } finally {
      setLoading(false)
    }
  }

  async function handleReview(action: 'approve' | 'reject') {
    const reason = action === 'reject' ? window.prompt('Reason for rejection (optional)') ?? undefined : undefined
    setActing(true)
    try {
      await dataPortalApi.review(id, action, reason)
      toast.success(action === 'approve' ? 'Submission approved and processed' : 'Submission rejected')
      void load()
    } catch (err: any) {
      toast.error(err?.message ?? 'Action failed')
    } finally {
      setActing(false)
    }
  }

  if (loading || !detail) {
    return (
      <div className="min-h-screen px-8 py-8">
        <div className="card p-12 text-center text-lg font-semibold text-navy">Loading…</div>
      </div>
    )
  }

  const isAdmin = user?.role === 'admin'
  const awaitingReview = detail.status === 'submitted' || detail.status === 'under_review'
  const headers = detail.latest_version ? Object.keys(detail.latest_version.mapping) : []

  return (
    <div className="min-h-screen px-8 py-8">
      <Link href="/filmmaker" className="mb-4 flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600">
        <ChevronLeft size={14} /> Back to Data Portal
      </Link>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-navy">{detail.name}</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
            <StatusBadge status={detail.status} /> · {detail.row_count} rows · {detail.category}
          </p>
        </div>
        {isAdmin && awaitingReview && (
          <div className="flex gap-2">
            <button disabled={acting} onClick={() => handleReview('approve')} className="btn-primary flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700">
              <Check size={14} /> Approve
            </button>
            <button disabled={acting} onClick={() => handleReview('reject')} className="flex items-center gap-1 rounded-md border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
              <X size={14} /> Reject
            </button>
          </div>
        )}
      </div>

      {detail.rejection_reason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Rejected: {detail.rejection_reason}
        </div>
      )}

      <div className="mb-6">
        <ValidationPanel validation={detail.validation} />
      </div>

      {detail.latest_version && detail.latest_version.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50">
                {headers.map((h) => <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-500">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {detail.latest_version.rows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  {headers.map((h) => <td key={h} className="px-2 py-1.5 text-slate-600">{row[h]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
