export type SeverityTone = 'info' | 'warn' | 'critical'

/** Maps backend severity strings onto the three severity tokens used across the console. */
export function severityTone(severity: string): SeverityTone {
  const s = severity.toLowerCase()
  if (s === 'critical' || s === 'high') return 'critical'
  if (s === 'warn' || s === 'warning' || s === 'medium') return 'warn'
  return 'info'
}
