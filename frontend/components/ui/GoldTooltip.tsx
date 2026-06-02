// GoldTooltip.tsx — custom Recharts tooltip
// Recharts passes TooltipProps: {active, payload, label}
// Each payload entry has: name, value, color (from stroke for lines, fill for bars)

export interface GoldTooltipPayload {
  name:   string
  value:  number | string
  color?: string
  stroke?: string
  fill?:   string
}

interface GoldTooltipProps {
  active?:    boolean
  payload?:   GoldTooltipPayload[]
  label?:     string | number
  formatter?: (val: number, name: string) => string
}

export function GoldTooltip({
  active,
  payload,
  label,
  formatter,
}: GoldTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-white/10 bg-[#0c0f1a] px-4 py-3 text-xs shadow-xl">
      {label !== undefined && (
        <p className="mb-2 font-semibold text-gray-400">{String(label)}</p>
      )}
      {payload.map((p, i) => {
        // Recharts uses stroke for lines, fill for bars; fall back to a default
        const dotColor = p.color ?? p.stroke ?? p.fill ?? '#8892a4'
        const displayValue =
          typeof p.value === 'number' && formatter
            ? formatter(p.value, p.name)
            : typeof p.value === 'number'
            ? `$${p.value.toLocaleString()}M`
            : String(p.value)

        return (
          <p key={i} className="font-mono" style={{ color: dotColor }}>
            {p.name}: {displayValue}
          </p>
        )
      })}
    </div>
  )
}
