import { useCallback, useEffect, useState } from 'react'
import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { Drawer } from '../../shared/Drawer'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchFileEvents, type FileEventRow } from '../../lib/api'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function FilesPage() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<FileEventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<FileEventRow | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchFileEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 100 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <DomainPageLayout
      title="Files"
      lead="File and move events. Click a row for full metadata."
    >
      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        <EmptyState
          title="No file events"
          message="File and move events will appear here once the ingest and read APIs are connected. Hook up GET /api/events/files to populate this table."
        />
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Type</th>
                <th>Path</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr
                  key={e.id}
                  className="tt-table-row--clickable"
                  onClick={() => setSelected(e)}
                >
                  <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                  <td className="tt-table-cell--mono tt-table-cell--muted">{e.agent_id}</td>
                  <td>{e.event_type}</td>
                  <td className="tt-table-cell--mono" style={{ maxWidth: '20rem', overflow: 'hidden', textOverflow: 'ellipsis' }} title={e.file_path ?? ''}>
                    {e.file_path ?? '—'}
                  </td>
                  <td>{e.action ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `Event #${selected.id}` : ''}>
        {selected && (
          <>
            <dl className="tt-ml-meta">
              <div>
                <dt>Time</dt>
                <dd>{formatTime(selected.timestamp)}</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd>{selected.agent_id}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{selected.event_type}</dd>
              </div>
              <div>
                <dt>Path</dt>
                <dd style={{ wordBreak: 'break-all' }}>{selected.file_path ?? '—'}</dd>
              </div>
              <div>
                <dt>Action</dt>
                <dd>{selected.action ?? '—'}</dd>
              </div>
            </dl>
            {selected.extra_data && Object.keys(selected.extra_data).length > 0 && (
              <>
                <h3 style={{ marginTop: '1rem', marginBottom: '0.5rem', fontSize: '0.875rem' }}>Extra data</h3>
                <pre className="tt-extra-data">{JSON.stringify(selected.extra_data, null, 2)}</pre>
              </>
            )}
          </>
        )}
      </Drawer>
    </DomainPageLayout>
  )
}
