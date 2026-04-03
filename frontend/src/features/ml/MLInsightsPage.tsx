import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useShellFilters } from '../../layout/useShellFilters'
import { MlInsightDrawer } from './MlInsightDrawer'
import { MlInsightTable } from './MlInsightTable'
import { useMlInsights } from './useMlInsights'
import { useMlSummary } from './useMlSummary'
import { ErrorRetry } from '../../shared/ErrorRetry'
import type { MlInsight } from '../../lib/api'

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function MLInsightsPage() {
  const { buildPath, timeRange, agentFilter } = useShellFilters()
  const summary = useMlSummary({ time_range: timeRange, agent_id: agentFilter || undefined })
  const insights = useMlInsights({ time_range: timeRange, agent_id: agentFilter || undefined, limit: 100 })
  const [selectedInsight, setSelectedInsight] = useState<MlInsight | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleRowClick = (insight: MlInsight) => {
    setSelectedInsight(insight)
    setDrawerOpen(true)
  }

  return (
    <div className="tt-page tt-ml-page">
      <p className="tt-ml-page__back">
        <Link className="tt-link" to={buildPath('/overview')}>
          ← Overview
        </Link>
      </p>
      <h1 className="tt-page__title">ML / Insights</h1>
      <p className="tt-page__lead">
        Full model output, drill-down, and explainability. Wire to{' '}
        <code className="tt-inline-code">GET /ml/insights</code> and{' '}
        <code className="tt-inline-code">GET /ml/summary</code> when ready.
      </p>

      <section className="tt-dash__section" aria-labelledby="ml-model-heading">
        <h2 id="ml-model-heading" className="tt-dash__h2">
          Model
        </h2>
        {summary.status === 'loading' ? (
          <p className="tt-dash__muted">Loading…</p>
        ) : summary.status === 'error' ? (
          <ErrorRetry message={(summary as { message: string }).message} onRetry={summary.refetch} />
        ) : (
          <dl className="tt-ml-meta">
            <div>
              <dt>Name / version</dt>
              <dd>{summary.data?.model_name ?? summary.data?.model_version ?? 'Not configured'}</dd>
            </div>
            <div>
              <dt>Last inference</dt>
              <dd>{summary.data?.last_inference ? formatTime(summary.data.last_inference) : '—'}</dd>
            </div>
            <div>
              <dt>Data window</dt>
              <dd>{summary.data?.data_window ?? '—'}</dd>
            </div>
          </dl>
        )}
      </section>

      <section className="tt-dash__section" aria-labelledby="ml-insights-heading">
        <h2 id="ml-insights-heading" className="tt-dash__h2">
          Insights
        </h2>
        {insights.status === 'loading' ? (
          <div className="tt-feed-empty">
            <p className="tt-dash__muted">Loading…</p>
          </div>
        ) : insights.status === 'error' ? (
          <ErrorRetry message={(insights as { message: string }).message} onRetry={insights.refetch} />
        ) : insights.data.length === 0 ? (
          <div className="tt-feed-empty">
            <p className="tt-dash__muted">
              No insights yet — model offline, insufficient data, or no anomalies detected.
            </p>
          </div>
        ) : (
          <MlInsightTable insights={insights.data} onRowClick={handleRowClick} />
        )}
      </section>

      <section className="tt-dash__section" aria-labelledby="ml-viz-heading">
        <h2 id="ml-viz-heading" className="tt-dash__h2">
          Trends
        </h2>
        <div className="tt-chart-placeholder">
          <p className="tt-dash__muted">
            Timelines and distributions for scores / anomalies will appear when the API returns series
            data.
          </p>
        </div>
      </section>

      <MlInsightDrawer insight={selectedInsight} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
