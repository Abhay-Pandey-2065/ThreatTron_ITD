import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchProcessEvents, type ProcessEventRow } from '../../lib/api'
import { EventFilters } from '../../shared/EventFilters'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function ProcessesPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<ProcessEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchProcessEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 1000 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <DomainPageLayout title="Processes" lead="Process lifecycle events (start, terminate, startup).">
      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : (
        <EventFilters events={events} searchText={(event) => [event.agent_id, event.event_type, event.process_name, event.exe_path, event.parent_name, event.parent_pid].join(' ')}>
          {(filteredEvents) => filteredEvents.length === 0 ? (
        <EmptyState title={events.length ? 'No matching process events' : 'No process events'} message={events.length ? 'Adjust the search or date filters.' : 'Process events will appear here once telemetry is available.'} />
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Type</th>
                <th>Process</th>
                <th>Executable</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr key={e.id}>
                  <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                  <td className="tt-table-cell--mono tt-table-cell--muted">{e.agent_id}</td>
                  <td>{e.event_type}</td>
                  <td>{e.process_name ?? '—'}</td>
                  <td className="tt-table-cell--mono" style={{ maxWidth: '18rem', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.exe_path ?? ''}>
                    {e.exe_path ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </EventFilters>
      )}
    </DomainPageLayout>
  )
}
