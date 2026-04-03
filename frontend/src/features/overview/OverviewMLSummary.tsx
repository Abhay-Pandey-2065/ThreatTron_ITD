import { Link } from 'react-router-dom'
import { useShellFilters } from '../../layout/useShellFilters'
import { useMlSummary } from '../ml/useMlSummary'
import { ErrorRetry } from '../../shared/ErrorRetry'

/** Uses GET /ml/summary — same API as ML page; refetches on window focus. */
export function OverviewMLSummary() {
  const { buildPath, timeRange, agentFilter } = useShellFilters()
  const mlSummary = useMlSummary(
    { time_range: timeRange, agent_id: agentFilter || undefined },
    { refetchOnFocus: true },
  )

  const { status, refetch } = mlSummary
  const data = 'data' in mlSummary ? mlSummary.data : null

  if (status === 'loading') {
    return (
      <section className="tt-dash__section" aria-labelledby="ml-summary-heading">
        <div className="tt-dash__section-head">
          <h2 id="ml-summary-heading" className="tt-dash__h2">
            Model insights
          </h2>
          <Link className="tt-link tt-dash__section-link" to={buildPath('/ml')}>
            View all →
          </Link>
        </div>
        <p className="tt-dash__muted">Loading…</p>
        <div className="tt-ml-strip" role="group" aria-label="ML summary metrics">
          <div className="tt-ml-strip__item">
            <span className="tt-ml-strip__label">Open alerts</span>
            <span className="tt-ml-strip__value">…</span>
          </div>
          <div className="tt-ml-strip__item">
            <span className="tt-ml-strip__label">High severity (24h)</span>
            <span className="tt-ml-strip__value">…</span>
          </div>
          <div className="tt-ml-strip__item">
            <span className="tt-ml-strip__label">Last model run</span>
            <span className="tt-ml-strip__value">…</span>
          </div>
        </div>
      </section>
    )
  }

  if (status === 'error') {
    const err = mlSummary as { message: string }
    return (
      <section className="tt-dash__section" aria-labelledby="ml-summary-heading">
        <div className="tt-dash__section-head">
          <h2 id="ml-summary-heading" className="tt-dash__h2">
            Model insights
          </h2>
          <Link className="tt-link tt-dash__section-link" to={buildPath('/ml')}>
            View all →
          </Link>
        </div>
        <ErrorRetry message={err.message} onRetry={refetch} />
      </section>
    )
  }

  const summaryData = data
  const configured = summaryData && (summaryData.model_name ?? summaryData.last_inference)
  const openAlerts = summaryData?.open_alerts
  const highSev = summaryData?.high_severity_24h
  const lastRun = summaryData?.last_inference

  return (
    <section className="tt-dash__section" aria-labelledby="ml-summary-heading">
      <div className="tt-dash__section-head">
        <h2 id="ml-summary-heading" className="tt-dash__h2">
          Model insights
        </h2>
        <Link className="tt-link tt-dash__section-link" to={buildPath('/ml')}>
          View all →
        </Link>
      </div>
      {!configured && (
        <p className="tt-dash__muted">
          Model not configured — connect an ML API to show anomaly counts, risk scores, and last run
          time here.
        </p>
      )}
      <div className="tt-ml-strip" role="group" aria-label="ML summary metrics">
        <div className="tt-ml-strip__item">
          <span className="tt-ml-strip__label">Open alerts</span>
          <span className="tt-ml-strip__value">
            {openAlerts != null ? String(openAlerts) : 'N/A'}
          </span>
        </div>
        <div className="tt-ml-strip__item">
          <span className="tt-ml-strip__label">High severity (24h)</span>
          <span
            className={`tt-ml-strip__value ${highSev != null && highSev > 0 ? 'tt-ml-strip__value--critical' : ''}`}
          >
            {highSev != null ? String(highSev) : 'N/A'}
          </span>
        </div>
        <div className="tt-ml-strip__item">
          <span className="tt-ml-strip__label">Last model run</span>
          <span className="tt-ml-strip__value">
            {lastRun
              ? new Date(lastRun).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
              : '—'}
          </span>
        </div>
      </div>
    </section>
  )
}
