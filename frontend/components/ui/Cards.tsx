'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// ── Badge style map ────────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, string> = {
  gold:   'badge-gold',
  cyan:   'badge-cyan',
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
  badgeColor = 'gold',
  className,
  children,
}: ChartCardProps) {
  return (
    <div className={cn('glass-card p-6', className)}>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h3 className="font-display text-lg tracking-wide text-white">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
        {badge && (
          <span className={BADGE_STYLES[badgeColor] ?? 'badge-gold'}>{badge}</span>
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
  /** When true change text is green; false = red; undefined = green (default) */
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
      className="relative overflow-hidden rounded-xl border border-white/[0.07]
                 bg-white/[0.02] p-5 transition-colors hover:border-white/[0.12]"
    >
      <div className="mb-3 flex items-center gap-2">
        <Icon size={13} style={{ color }} />
        <span className="text-[11px] font-semibold uppercase tracking-[2px] text-gray-500">
          {label}
        </span>
      </div>
      <div
        className="mb-2 font-display text-3xl leading-none tracking-wide"
        style={{ color }}
      >
        {value}
      </div>
      {change && (
        <div
          className={cn(
            'text-xs font-medium',
            up === false ? 'text-red-400' : 'text-emerald-400',
          )}
        >
          {change}
        </div>
      )}
      <div
        className="absolute bottom-0 left-0 right-0 h-[2px] opacity-25"
        style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
      />
    </motion.div>
  )
}
