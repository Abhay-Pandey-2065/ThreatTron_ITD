import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShellFilters } from '../../layout/useShellFilters'
import {
  fetchSecurityAlerts,
  fetchSecurityOverview,
  type SecurityAlert,
  type SecurityOverview,
} from '../../lib/api'
import { ErrorRetry } from '../../shared/ErrorRetry'
import { formatAbsoluteUtc, formatRelative } from '../../shared/format'
import { severityTone } from '../../shared/severity'

const ATTENTION_LIMIT = 5

/** Triage row: what needs an analyst right now. Counts are global; the list honours the agent filter. */
export function OverviewTriage() {
  const { agentFilter, buildPath } = useShellFilters()
  const [overview, setOverview] = useState<SecurityOverview | null>(null)
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(() => {
    setError(null)
    setLoading(true)
    Promise.all([
      fetchSecurityOverview(),
      fetchSecurityAlerts({ status: 'open', agent_id: agentFilter || undefined, limit: ATTENTION_LIMIT }),
    ])
      .then(([stats, openAlerts]) => {
        setOverview(stats)
        setAlerts(openAlerts)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [agentFilter])

  useEffect(() => {
    refetch()
  }, [refetch])

  const bySeverity = overview?.open_by_severity
  const critical = bySeverity ? (bySeverity.critical ?? 0) : null
  const high = bySeverity ? (bySeverity.high ?? 0) : null
  const show = (n: number | null | undefined) => (loading ? '…' : n != null ? String(n) : '—')

  return (
    <section className="tt-dash__section" aria-labelledby="triage-heading">
      <div className="tt-dash__section-head">
        <h2 id="triage-heading" className="tt-dash__h2">
          Needs attention
        </h2>
        <Link className="tt-link tt-dash__section-link" to={buildPath('/alerts')}>
          Open alert queue →
        </Link>
      </div>

      {error ? (
        <ErrorRetry message={error} onRetry={refetch} />
      ) : (
        <>
          <div className="tt-kpi-row" aria-label="Triage metrics">
            <div className="tt-kpi-card">
              <span className="tt-kpi-card__label">Open alerts</span>
              <span className="tt-kpi-card__value">{show(overview?.open_alerts)}</span>
              <span className="tt-kpi-card__hint">Open, acknowledged or investigating</span>
            </div>
            <div className={`tt-kpi-card ${critical ? 'tt-kpi-card--critical' : ''}`}>
              <span className="tt-kpi-card__label">Critical</span>
              <span className="tt-kpi-card__value">{show(critical)}</span>
              <span className="tt-kpi-card__hint">Risk ≥ 90</span>
            </div>
            <div className={`tt-kpi-card ${high ? 'tt-kpi-card--warn' : ''}`}>
              <span className="tt-kpi-card__label">High</span>
              <span className="tt-kpi-card__value">{show(high)}</span>
              <span className="tt-kpi-card__hint">Risk 70–89</span>
            </div>
            <div className="tt-kpi-card">
              <span className="tt-kpi-card__label">Open investigations</span>
              <span className="tt-kpi-card__value">{show(overview?.investigations)}</span>
              <Link className="tt-link tt-kpi-card__hint" to={buildPath('/investigations')}>
                View cases
              </Link>
            </div>
          </div>

          {loading ? null : alerts.length === 0 ? (
            <p className="tt-dash__muted tt-triage__empty">
              {agentFilter ? `No new alerts for ${agentFilter}.` : 'No new alerts awaiting triage.'}
            </p>
          ) : (
            <ul className="tt-triage-list">
              {alerts.map((alert) => {
                const tone = severityTone(alert.severity)
                const riskPct = Math.round(alert.risk_score * 100)
                return (
                  <li key={alert.id} className="tt-triage-item">
                    <span className={`tt-severity tt-severity--${tone}`}>{alert.severity}</span>
                    <span className="tt-triage-item__title">{alert.title}</span>
                    <span className="tt-mono tt-triage-item__agent" title={alert.agent_id}>
                      {alert.agent_id}
                    </span>
                    <span className="tt-mono tt-triage-item__risk" title={`Risk ${riskPct} of 100`}>
                      {riskPct}
                    </span>
                    <span
                      className="tt-mono tt-table-cell--nowrap tt-triage-item__time"
                      title={formatAbsoluteUtc(alert.last_seen_at)}
                    >
                      {formatRelative(alert.last_seen_at)}
                    </span>
                    <Link className="tt-link" to={buildPath('/alerts')}>
                      Triage
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
