import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchSystemEvents, type SystemEventRow } from '../../lib/api'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

export function SystemPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<SystemEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchSystemEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 100 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <DomainPageLayout title="System" lead="CPU and memory usage over time.">
      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        <>
          <section className="tt-dash__section" style={{ marginBottom: '1rem' }}>
            <h2 className="tt-dash__h2">CPU / Memory over time</h2>
            <div className="tt-chart-placeholder">
              <p className="tt-dash__muted">
                Time-series charts will render here when the system events API returns data.
              </p>
            </div>
          </section>
          <EmptyState
            title="No system events"
            message="CPU and memory metrics will appear here once the ingest and read APIs are connected. Hook up GET /api/events/system to populate this table and charts."
          />
        </>
      ) : (
        <>
          <section className="tt-dash__section" style={{ marginBottom: '1rem' }}>
            <h2 className="tt-dash__h2">CPU / Memory over time</h2>
            <div className="tt-chart-placeholder">
              <p className="tt-dash__muted">
                Time-series charts will render here when the API provides aggregated series data.
              </p>
            </div>
          </section>
          <div className="tt-table-wrap">
            <table className="tt-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Agent</th>
                  <th>CPU</th>
                  <th>Memory</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                    <td className="tt-table-cell--mono tt-table-cell--muted">{e.agent_id}</td>
                    <td className="tt-table-cell--mono">{fmtPct(e.cpu_usage)}</td>
                    <td className="tt-table-cell--mono">{fmtPct(e.memory_usage)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </DomainPageLayout>
  )
}
