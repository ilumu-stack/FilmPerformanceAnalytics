// ChartTooltip — custom Recharts tooltip styled for the light theme
// Recharts passes TooltipProps: {active, payload, label}
// Each payload entry has: name, value, color (from stroke for lines, fill for bars)

export interface GoldTooltipPayload {
  name:    string
  value:   number | string
  color?:  string
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
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-lg shadow-slate-200/60">
      {label !== undefined && (
        <p className="mb-2 font-semibold text-slate-600">{String(label)}</p>
      )}
      {payload.map((p, i) => {
        const dotColor = p.color ?? p.stroke ?? p.fill ?? '#64748b'
        const displayValue =
          typeof p.value === 'number' && formatter
            ? formatter(p.value, p.name)
            : typeof p.value === 'number'
            ? `$${p.value.toLocaleString()}M`
            : String(p.value)

        return (
          <p key={i} className="font-mono font-medium" style={{ color: dotColor }}>
            {p.name}: {displayValue}
          </p>
        )
      })}
    </div>
  )
}
