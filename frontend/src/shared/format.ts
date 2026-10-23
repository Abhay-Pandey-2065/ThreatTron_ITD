/** Parse a timestamp from the API. The backend sends UTC times without a zone marker (e.g. 2026-10-23T11:40:00), so those are read as UTC; times with a zone are unchanged. */
const NAIVE_DATETIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(:\d{2}(\.\d+)?)?)$/

export function parseTimestamp(ts: string): Date {
  const text = ts.trim()
  if (NAIVE_DATETIME.test(text)) return new Date(`${text.replace(' ', 'T')}Z`)
  return new Date(text)
}

/** Absolute UTC timestamp for tooltips and detail views, e.g. "2026-10-11 04:29:00 UTC". */
export function formatAbsoluteUtc(ts: string): string {
  const d = parseTimestamp(ts)
  if (isNaN(d.getTime())) return ts
  return `${d.toISOString().replace('T', ' ').slice(0, 19)} UTC`
}

/** Short relative time for tables, e.g. "2m ago". Falls back to the UTC date after a week. */
export function formatRelative(ts: string, now: number = Date.now()): string {
  const t = parseTimestamp(ts).getTime()
  if (isNaN(t)) return ts
  const seconds = Math.max(0, Math.floor((now - t) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatAbsoluteUtc(ts).slice(0, 10)
}

/** Plain-language names for the global time-range presets. */
export const RANGE_LABELS: Record<string, string> = {
  '1h': 'Last hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  custom: 'Custom range',
}

export function rangeLabel(range: string): string {
  return RANGE_LABELS[range] ?? range
}
