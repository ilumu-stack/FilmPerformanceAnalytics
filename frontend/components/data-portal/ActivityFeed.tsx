import { Clock } from 'lucide-react'
import type { ActivityEntry } from '@/lib/api'

const ACTION_LABEL: Record<string, string> = {
  'submission.created':        'created submission',
  'submission.submitted':      'submitted for review',
  'submission.review_started': 'started reviewing',
  'submission.approved':       'approved submission',
  'submission.rejected':       'rejected submission',
}

export default function ActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-[2px] text-slate-400">My Activity</h3>
      {activity.length === 0 ? (
        <p className="text-sm text-slate-400">No recent activity.</p>
      ) : (
        <ul className="space-y-3">
          {activity.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-sm">
              <Clock size={14} className="mt-0.5 shrink-0 text-slate-300" />
              <span className="text-slate-600">
                <span className="font-medium text-slate-800">{a.actor_name ?? 'Someone'}</span>{' '}
                {ACTION_LABEL[a.action] ?? a.action}
                {a.created_at && (
                  <span className="ml-1 text-xs text-slate-400">
                    · {new Date(a.created_at).toLocaleDateString('en-UG', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
