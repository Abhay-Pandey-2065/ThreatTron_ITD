import { useCallback, useEffect, useState } from 'react'
import { useShellFilters } from '../../layout/useShellFilters'
import { fetchOverviewStats, type OverviewStats } from '../../lib/api'
import { ErrorRetry } from '../../shared/ErrorRetry'

export function OverviewKPIRow() {
  const { timeRange, agentFilter } = useShellFilters()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchOverviewStats({ time_range: timeRange, agent_id: agentFilter || undefined })
      .then((data) => setStats(data ?? null))
      .catch((err) => setError(err?.message ?? 'Failed to load'))
      .finally(() => setLoading(false))
  }, [timeRange, agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  if (error) {
    return (
      <section className="tt-kpi-row" aria-label="Key metrics">
        <ErrorRetry message={error} onRetry={refetch} />
      </section>
    )
  }

  const total = stats?.total_events ?? null
  const byType = stats?.by_type
  const typeSummary =
    byType && Object.keys(byType).length > 0
      ? Object.entries(byType)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' · ')
      : null
  const agents = stats?.active_agents ?? null

  return (
    <section className="tt-kpi-row" aria-label="Key metrics">
      <div className="tt-kpi-card">
        <span className="tt-kpi-card__label">Events ({timeRange})</span>
        <span className="tt-kpi-card__value">
          {loading ? '…' : total != null ? String(total) : '—'}
        </span>
        <span className="tt-kpi-card__hint">
          {loading ? 'Loading…' : total == null ? 'Telemetry API pending' : 'In range'}
        </span>
      </div>
      <div className="tt-kpi-card">
        <span className="tt-kpi-card__label">By type</span>
        <span className="tt-kpi-card__value tt-kpi-card__value--small">
          {loading ? '…' : typeSummary ?? '—'}
        </span>
        <span className="tt-kpi-card__hint">
          {loading ? 'Loading…' : typeSummary ? 'Breakdown' : 'File / process / system…'}
        </span>
      </div>
      <div className="tt-kpi-card">
        <span className="tt-kpi-card__label">Agents</span>
        <span className="tt-kpi-card__value">
          {loading ? '…' : agents != null ? String(agents) : agentFilter ? '1' : 'All'}
        </span>
        <span className="tt-kpi-card__hint">
          {loading ? 'Loading…' : agents != null ? 'Active' : 'Filter in header'}
        </span>
      </div>
    </section>
  )
}
