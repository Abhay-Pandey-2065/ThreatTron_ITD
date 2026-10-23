import { useEffect, useState } from 'react'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchRecentEvents, type RecentEvent } from '../../lib/api'
import { formatAbsoluteUtc, formatRelative } from '../../shared/format'

/** Number of recent events sampled for the sparkline and agent table. */
const SAMPLE_LIMIT = 200
const MAX_AGENT_ROWS = 10

interface VolumeWindow {
  buckets: number
  bucketMs: number
  hours: number | null
  label: string
}

function presetWindow(timeRange: string): VolumeWindow | null {
  switch (timeRange) {
    case '1h':
      return { buckets: 12, bucketMs: 5 * 60_000, hours: 1, label: '5-minute buckets' }
    case '24h':
      return { buckets: 24, bucketMs: 3_600_000, hours: 24, label: 'hourly buckets' }
    case '7d':
      return { buckets: 7, bucketMs: 86_400_000, hours: 168, label: 'daily buckets' }
    default:
      return null
  }
}

function buildVolume(events: RecentEvent[], timeRange: string, now: number) {
  const times = events.map((e) => new Date(e.timestamp).getTime()).filter((t) => !isNaN(t))
  const preset = presetWindow(timeRange)

  if (preset) {
    const start = now - preset.buckets * preset.bucketMs
    const counts = new Array<number>(preset.buckets).fill(0)
    for (const t of times) {
      const idx = Math.floor((t - start) / preset.bucketMs)
      if (idx >= 0 && idx < preset.buckets) counts[idx]++
    }
    return { counts, window: preset, spanHours: preset.hours ?? 1 }
  }

  if (times.length === 0) {
    return { counts: [] as number[], window: null, spanHours: 1 }
  }
  const min = Math.min(...times)
  const max = Math.max(...times)
  const buckets = 24
  const bucketMs = Math.max(1, (max - min + 1) / buckets)
  const counts = new Array<number>(buckets).fill(0)
  for (const t of times) {
    counts[Math.min(buckets - 1, Math.floor((t - min) / bucketMs))]++
  }
  return {
    counts,
    window: { buckets, bucketMs, hours: null, label: 'buckets across sampled range' },
    spanHours: Math.max((max - min) / 3_600_000, 1 / 60),
  }
}

interface AgentSummary {
  agent: string
  count: number
  lastSeen: string
  lastSeenMs: number
}

function summarizeAgents(events: RecentEvent[]): AgentSummary[] {
  const byAgent = new Map<string, AgentSummary>()
  for (const e of events) {
    const ms = new Date(e.timestamp).getTime()
    const existing = byAgent.get(e.agent_id)
    if (existing) {
      existing.count++
      if (!isNaN(ms) && ms > existing.lastSeenMs) {
        existing.lastSeenMs = ms
        existing.lastSeen = e.timestamp
      }
    } else {
      byAgent.set(e.agent_id, {
        agent: e.agent_id,
        count: 1,
        lastSeen: e.timestamp,
        lastSeenMs: isNaN(ms) ? 0 : ms,
      })
    }
  }
  return [...byAgent.values()].sort((a, b) => b.lastSeenMs - a.lastSeenMs).slice(0, MAX_AGENT_ROWS)
}

function Sparkline({ counts, description }: { counts: number[]; description: string }) {
  const W = 320
  const H = 120
  const PAD_L = 28
  const PAD_T = 8
  const PAD_B = 6
  const innerW = W - PAD_L
  const innerH = H - PAD_T - PAD_B
  const max = Math.max(1, ...counts)
  const step = counts.length > 1 ? innerW / (counts.length - 1) : 0

  const points = counts.map((c, i) => ({
    x: PAD_L + i * step,
    y: PAD_T + innerH - (c / max) * innerH,
  }))
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const area = last
    ? `${line} L${last.x.toFixed(1)} ${PAD_T + innerH} L${PAD_L} ${PAD_T + innerH} Z`
    : ''

  return (
    <svg className="tt-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description}>
      {[0, 0.5, 1].map((f) => (
        <line
          key={f}
          className="tt-spark__grid"
          x1={PAD_L}
          x2={W}
          y1={PAD_T + innerH * (1 - f)}
          y2={PAD_T + innerH * (1 - f)}
        />
      ))}
      <text className="tt-spark__axis" x={0} y={PAD_T + 4}>
        {max}
      </text>
      <text className="tt-spark__axis" x={0} y={PAD_T + innerH}>
        0
      </text>
      {area ? <path className="tt-spark__area" d={area} /> : null}
      {line ? <path className="tt-spark__line" d={line} /> : null}
    </svg>
  )
}

export function OverviewActivityPanel() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<RecentEvent[]>([])
  // Time the sample was taken; null until the first response arrives.
  const [sampledAt, setSampledAt] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    // fetchRecentEvents resolves to [] on failure, so there is no error branch here.
    fetchRecentEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: SAMPLE_LIMIT }).then(
      (data) => {
        if (cancelled) return
        setEvents(data ?? [])
        setSampledAt(Date.now())
      },
    )
    return () => {
      cancelled = true
    }
  }, [timeRange, agentFilter])

  const loading = sampledAt === null
  const now = sampledAt ?? 0
  const { counts, window: volumeWindow, spanHours } = buildVolume(events, timeRange, now)
  const agents = summarizeAgents(events)

  return (
    <section className="tt-dash__section" aria-labelledby="activity-heading">
      <div className="tt-dash__section-head">
        <h2 id="activity-heading" className="tt-dash__h2">
          Activity and agents
        </h2>
        <span className="tt-activity__caption">
          {loading ? 'Loading…' : `Sampled ${events.length} of the latest ${SAMPLE_LIMIT} events`}
        </span>
      </div>

      {loading ? (
        <p className="tt-dash__muted">Loading…</p>
      ) : events.length === 0 ? (
        <p className="tt-dash__muted">No events in this range.</p>
      ) : (
        <div className="tt-activity">
          <div>
            <Sparkline
              counts={counts}
              description={`Event volume: ${counts.reduce((a, b) => a + b, 0)} events in ${counts.length} buckets`}
            />
            <p className="tt-activity__caption">
              Event volume, {volumeWindow?.label ?? 'bucketed'}. Sampled from the latest events, so
              very busy windows are undercounted.
            </p>
          </div>

          <div className="tt-agents-table">
            <div className="tt-table-wrap">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th className="tt-num">Events</th>
                    <th className="tt-num">Per hour</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((row) => (
                    <tr key={row.agent}>
                      <td className="tt-mono" title={row.agent}>
                        {row.agent}
                      </td>
                      <td className="tt-num">{row.count}</td>
                      <td className="tt-num">
                        {(row.count / spanHours).toFixed(spanHours >= 1 ? 0 : 1)}
                      </td>
                      <td className="tt-mono tt-table-cell--nowrap" title={formatAbsoluteUtc(row.lastSeen)}>
                        {formatRelative(row.lastSeen, now)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
