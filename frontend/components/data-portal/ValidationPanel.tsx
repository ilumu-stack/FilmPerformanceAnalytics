import { AlertTriangle, XCircle, CopyX } from 'lucide-react'
import type { ValidationResult } from '@/lib/api'

export default function ValidationPanel({ validation }: { validation: ValidationResult | null }) {
  if (!validation) {
    return (
      <div className="card p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[2px] text-slate-400">Validation Issues</h3>
        <p className="text-sm text-slate-400">No data uploaded yet.</p>
      </div>
    )
  }

  const { errors, warnings, duplicates, summary } = validation
  const clean = summary.error_count === 0 && summary.warning_count === 0 && summary.duplicate_count === 0

  return (
    <div className="card p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-[2px] text-slate-400">Validation Issues</h3>
      <div className="mb-3 flex gap-4 text-sm">
        <span className="flex items-center gap-1 text-red-600"><XCircle size={14} /> {summary.error_count} errors</span>
        <span className="flex items-center gap-1 text-amber-600"><AlertTriangle size={14} /> {summary.warning_count} warnings</span>
        <span className="flex items-center gap-1 text-slate-500"><CopyX size={14} /> {summary.duplicate_count} duplicates</span>
      </div>
      {clean ? (
        <p className="text-sm text-emerald-600">No issues found.</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-y-auto text-xs">
          {errors.map((e, i) => (
            <li key={`err-${i}`} className="flex items-start gap-1.5 text-red-600">
              <XCircle size={12} className="mt-0.5 shrink-0" /> Row {e.row + 1} · {e.field}: {e.message}
            </li>
          ))}
          {warnings.map((w, i) => (
            <li key={`warn-${i}`} className="flex items-start gap-1.5 text-amber-600">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" /> Row {w.row + 1} · {w.field}: {w.message}
            </li>
          ))}
          {duplicates.map((d, i) => (
            <li key={`dup-${i}`} className="flex items-start gap-1.5 text-slate-500">
              <CopyX size={12} className="mt-0.5 shrink-0" /> Duplicate rows: {d.rows.map((r) => r + 1).join(', ')}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
