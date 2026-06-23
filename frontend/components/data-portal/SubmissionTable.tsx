import Link from 'next/link'
import { FileBarChart } from 'lucide-react'
import type { Submission } from '@/lib/api'
import StatusBadge from './StatusBadge'

const CATEGORY_LABEL: Record<string, string> = {
  box_office:        'Box Office',
  streaming:         'Streaming',
  audience_research: 'Audience Research',
  marketing:         'Marketing',
  production:        'Production',
  custom:            'Custom Dataset',
}

export default function SubmissionTable({ submissions }: { submissions: Submission[] }) {
  if (submissions.length === 0) {
    return (
      <div className="card p-16 text-center">
        <FileBarChart size={48} className="mx-auto mb-4 text-slate-300" />
        <p className="text-lg font-semibold text-slate-700">No submissions yet</p>
        <p className="mt-1 text-sm text-slate-400">Create your first data submission to get started.</p>
      </div>
    )
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {['Name', 'Category', 'Status', 'Rows', 'Date'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[2px] text-slate-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/filmmaker/submissions/${s.id}`} className="font-semibold text-slate-800 hover:text-brand">
                  {s.name}
                </Link>
                {s.submitted_by_name && <div className="text-xs text-slate-400">{s.submitted_by_name}</div>}
              </td>
              <td className="px-4 py-3">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {CATEGORY_LABEL[s.category] ?? s.category}
                </span>
              </td>
              <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
              <td className="px-4 py-3 font-mono text-sm text-slate-600">{s.row_count}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {s.created_at ? new Date(s.created_at).toLocaleDateString('en-UG', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
