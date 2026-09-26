import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchSystemEvents, type SystemEventRow } from '../../lib/api'
import { EventFilters } from '../../shared/EventFilters'

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
  return `${v.toFixed(1)}%`
}

export function SystemPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<SystemEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [minCpu, setMinCpu] = useState('')
  const [maxCpu, setMaxCpu] = useState('')
  const [minMemory, setMinMemory] = useState('')
  const [maxMemory, setMaxMemory] = useState('')

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchSystemEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 1000 })
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
      ) : (
        <EventFilters
          events={events}
          searchText={(event) => [event.agent_id, event.cpu_usage, event.memory_usage].join(' ')}
          matches={(event) => {
            const inRange = (value: number | null, min: string, max: string) =>
              min === '' && max === '' || value != null && (min === '' || value >= Number(min)) && (max === '' || value <= Number(max))
            return inRange(event.cpu_usage, minCpu, maxCpu) && inRange(event.memory_usage, minMemory, maxMemory)
          }}
          extraControls={<>
            <label className="tt-filter"><span className="tt-filter__label">CPU min %</span><input className="tt-input tt-input--compact" type="number" min="0" max="100" value={minCpu} onChange={(event) => setMinCpu(event.target.value)} /></label>
            <label className="tt-filter"><span className="tt-filter__label">CPU max %</span><input className="tt-input tt-input--compact" type="number" min="0" max="100" value={maxCpu} onChange={(event) => setMaxCpu(event.target.value)} /></label>
            <label className="tt-filter"><span className="tt-filter__label">Memory min %</span><input className="tt-input tt-input--compact" type="number" min="0" max="100" value={minMemory} onChange={(event) => setMinMemory(event.target.value)} /></label>
            <label className="tt-filter"><span className="tt-filter__label">Memory max %</span><input className="tt-input tt-input--compact" type="number" min="0" max="100" value={maxMemory} onChange={(event) => setMaxMemory(event.target.value)} /></label>
          </>}
        >
          {(filteredEvents) => filteredEvents.length === 0 ? (
        <EmptyState title={events.length ? 'No matching system events' : 'No system events'} message={events.length ? 'Adjust the search, date, CPU, or memory filters.' : 'CPU and memory metrics will appear here once telemetry is available.'} />
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
              <thead><tr><th>Time</th><th>Agent</th><th>CPU</th><th>Memory</th></tr></thead>
              <tbody>
                {filteredEvents.map((e) => (
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
        </EventFilters>
      )}
    </DomainPageLayout>
  )
}
