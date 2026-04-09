import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchNetworkEvents, type NetworkEventRow } from '../../lib/api'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function shortHash(h: string | null): string {
  if (!h) return '—'
  return h.length > 12 ? `${h.slice(0, 6)}…${h.slice(-6)}` : h
}

export function NetworkPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<NetworkEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchNetworkEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 100 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <DomainPageLayout
      title="Network"
      lead="Ethical network telemetry: hashed IPs, ports, status. No payload capture."
    >
      <p className="tt-dash__muted" style={{ marginBottom: '1.25rem', maxWidth: '40rem' }}>
        Connection metadata with SHA-256 hashed IPs. Content and payloads are never captured.
        All telemetry is anonymized for privacy.
      </p>
      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No network events"
          message="Network connection metadata will appear here once the agent collects data."
        />
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Process</th>
                <th>Local Hash</th>
                <th>L.Port</th>
                <th>Remote Hash</th>
                <th>R.Port</th>
                <th>Status</th>
                <th>PID</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                  <td className="tt-table-cell--mono tt-table-cell--muted">{e.agent_id}</td>
                  <td>{e.process_name ?? '—'}</td>
                  <td className="tt-table-cell--mono" title={e.local_ip_hash ?? ''}>{shortHash(e.local_ip_hash)}</td>
                  <td className="tt-table-cell--mono">{e.local_port ?? '—'}</td>
                  <td className="tt-table-cell--mono" title={e.remote_ip_hash ?? ''}>{shortHash(e.remote_ip_hash)}</td>
                  <td className="tt-table-cell--mono">{e.remote_port ?? '—'}</td>
                  <td>{e.status ?? '—'}</td>
                  <td className="tt-table-cell--mono tt-table-cell--muted">{e.pid ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DomainPageLayout>
  )
}
