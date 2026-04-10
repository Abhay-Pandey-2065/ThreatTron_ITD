import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchEmailEvents, type EmailEventRow } from '../../lib/api'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function EmailPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<EmailEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchEmailEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 100 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <DomainPageLayout title="Email" lead="Metadata-only. No payload or body content stored.">
      <p className="tt-dash__muted" style={{ marginBottom: '1.25rem', maxWidth: '40rem' }}>
        Email events show sender, subject, snippet length, and link presence only. Content and
        attachments are never captured. This page respects privacy by design.
      </p>
      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No email events"
          message="Email metadata will appear here once the ingest and read APIs are connected. Hook up GET /api/events/emails to populate this table."
        />
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Sender</th>
                <th>Subject</th>
                <th>Snippet</th>
                <th>Links</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                  <td className="tt-table-cell--mono tt-table-cell--muted">{e.agent_id}</td>
                  <td style={{ maxWidth: '12rem', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.sender ?? ''}>
                    {e.sender ?? '—'}
                  </td>
                  <td style={{ maxWidth: '16rem', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.subject ?? ''}>
                    {e.subject ?? '—'}
                  </td>
                  <td className="tt-table-cell--muted">{e.snippet_length ?? '—'}</td>
                  <td>{e.has_links != null ? Number(e.has_links) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DomainPageLayout>
  )
}
