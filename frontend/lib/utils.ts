import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatMoney(value: number, compact = false): string {
  if (compact) {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
    if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
    return `$${value.toFixed(0)}`
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export function formatROI(roi: number): string {
  return `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function riskColor(level: string): string {
  const map: Record<string, string> = {
    LOW:       'text-emerald-400',
    MODERATE:  'text-yellow-400',
    HIGH:      'text-red-400',
    'VERY HIGH':'text-red-500',
  }
  return map[level] ?? 'text-gray-400'
}

export function riskBadgeClass(level: string): string {
  const map: Record<string, string> = {
    LOW:       'badge-green',
    MODERATE:  'badge-gold',
    HIGH:      'badge-red',
    'VERY HIGH':'badge-red',
  }
  return map[level] ?? 'badge-gold'
}

export const CHART_COLORS = ['#d4a843','#38d9f5','#22d49a','#9d6ef8','#f05068','#8892a4','#f0c060','#6ee7b7']
