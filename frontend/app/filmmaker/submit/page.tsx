'use client'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/lib/store'
import { dataPortalApi, type ReportTemplate } from '@/lib/api'
import UploadWizard from '@/components/data-portal/wizard/UploadWizard'

export default function SubmitPage() {
  const router = useRouter()
  const { isAuthed } = useAuthStore()
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!isAuthed) { router.replace('/auth/login'); return }
    dataPortalApi.listTemplates()
      .then(setTemplates)
      .catch((err: any) => toast.error(err?.message ?? 'Failed to load templates'))
      .finally(() => setLoading(false))
  }, [isAuthed, router])

  if (loading) {
    return (
      <div className="min-h-screen px-8 py-8">
        <div className="card p-12 text-center text-lg font-semibold text-navy">Loading…</div>
      </div>
    )
  }

  return <UploadWizard templates={templates} />
}
