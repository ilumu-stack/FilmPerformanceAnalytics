import type { SubmissionStatus } from '@/lib/api'

const STATUS_BADGE: Record<SubmissionStatus, string> = {
  draft:         'border-slate-200 bg-slate-100 text-slate-500',
  submitted:     'border-blue-200 bg-blue-50 text-blue-700',
  under_review:  'border-amber-200 bg-amber-50 text-amber-700',
  approved:      'border-emerald-200 bg-emerald-50 text-emerald-700',
  processed:     'border-teal-200 bg-teal-50 text-teal-700',
  rejected:      'border-red-200 bg-red-50 text-red-700',
}

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_BADGE[status]}`}>
      {status.replace('_', ' ')}
    </span>
  )
}
