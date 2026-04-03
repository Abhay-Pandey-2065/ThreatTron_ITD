import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchRecentEvents, type RecentEvent } from '../../lib/api'
import { ErrorRetry } from '../../shared/ErrorRetry'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function OverviewRecentFeed() {
  const { timeRange, agentFilter } = useShellFilters()
  const [events, setEvents] = useState<RecentEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchRecentEvents({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 20 })
      .then((data) => setEvents(data ?? []))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  return (
    <section className="tt-dash__section" aria-labelledby="feed-heading">
      <h2 id="feed-heading" className="tt-dash__h2">
        Recent activity
      </h2>
      {loading ? (
        <div className="tt-feed-empty">
          <p className="tt-dash__muted">Loading…</p>
        </div>
      ) : error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : events.length === 0 ? (
        <div className="tt-feed-empty">
          <p className="tt-dash__muted">
            No events loaded yet. Ingest and list APIs will populate this feed.
          </p>
        </div>
      ) : (
        <ul className="tt-feed-list">
          {events.map((e) => (
            <li key={`${e.type}-${e.id}`} className="tt-feed-item">
              <span className="tt-feed-item__type">{e.type}</span>
              <span className="tt-feed-item__time">{formatTime(e.timestamp)}</span>
              <span className="tt-feed-item__agent">{e.agent_id}</span>
              {e.ml_flagged ? (
                <Link className="tt-feed-item__badge tt-feed-item__badge--ml" to="/ml">
                  ML
                </Link>
              ) : (
                <span />
              )}
              <span className="tt-feed-item__summary">{e.summary}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
