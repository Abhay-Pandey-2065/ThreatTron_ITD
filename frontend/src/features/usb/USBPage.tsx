import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchUSBEvents, type USBEventRow } from '../../lib/api'
import { EventFilters } from '../../shared/EventFilters'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function USBPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<USBEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchUSBEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 1000 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <DomainPageLayout title="USB" lead="Insert and remove events with mountpoint.">
      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : (
        <EventFilters events={events} searchText={(event) => [event.agent_id, event.event_type, event.mountpoint].join(' ')}>
          {(filteredEvents) => filteredEvents.length === 0 ? (
        <EmptyState title={events.length ? 'No matching USB events' : 'No USB events'} message={events.length ? 'Adjust the search or date filters.' : 'USB events will appear here once telemetry is available.'} />
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Event</th>
                <th>Mountpoint</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((e) => (
                <tr key={e.id}>
                  <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                  <td className="tt-table-cell--mono tt-table-cell--muted">{e.agent_id}</td>
                  <td>{e.event_type}</td>
                  <td className="tt-table-cell--mono">{e.mountpoint ?? '—'}</td>
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
