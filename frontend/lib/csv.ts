/** Minimal CSV parser — handles quoted fields and commas inside quotes. No external dep. */
export function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0)
  if (lines.length === 0) return { headers: [], rows: [] }

  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let cur = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++ }
        else if (ch === '"') { inQuotes = false }
        else { cur += ch }
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { cells.push(cur); cur = '' }
        else cur += ch
      }
    }
    cells.push(cur)
    return cells.map((c) => c.trim())
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? '' })
    return row
  })

  return { headers, rows }
}
