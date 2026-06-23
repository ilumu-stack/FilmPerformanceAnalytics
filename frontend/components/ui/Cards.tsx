'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Badge style map ────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  gold:   'badge-amber',
  amber:  'badge-amber',
  cyan:   'badge-blue',
  blue:   'badge-blue',
  green:  'badge-green',
  purple: 'badge-purple',
  red:    'badge-red',
}

// ── ChartCard ─────────────────────────────────────────────────────────────
interface ChartCardProps {
  title:       string
  subtitle?:   string
  badge?:      string
  badgeColor?: string
  className?:  string
  children:    ReactNode
}

export function ChartCard({
  title,
  subtitle,
  badge,
  badgeColor = 'blue',
  className,
  children,
}: ChartCardProps) {
  return (
    <div className={cn('card p-6', className)}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-semibold text-navy">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
          )}
        </div>
        {badge && (
          <span className={cn('flex-shrink-0', BADGE_STYLES[badgeColor] ?? 'badge-blue')}>
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ── KpiCard ───────────────────────────────────────────────────────────────
interface KpiCardProps {
  label:   string
  value:   string
  change?: string
  up?:     boolean
  color:   string
  icon:    LucideIcon
  delay?:  number
}

export function KpiCard({
  label,
  value,
  change,
  up,
  color,
  icon: Icon,
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5
                 shadow-card transition-shadow hover:shadow-card-hover"
    >
      <div className="mb-3 flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: `${color}18` }}
        >
          <Icon size={15} style={{ color }} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[2px] text-slate-400">
          {label}
        </span>
      </div>
      <div
        className="mb-2 text-3xl font-bold leading-none"
        style={{ color }}
      >
        {value}
      </div>
      {change && (
        <div
          className={cn(
            'text-xs font-medium',
            up === false ? 'text-red-500' : 'text-emerald-600',
          )}
        >
          {change}
        </div>
      )}
      {/* Accent bar at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] opacity-30"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </motion.div>
  )
}
