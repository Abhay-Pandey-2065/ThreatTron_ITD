import { OverviewChartsPlaceholder } from '../features/overview/OverviewChartsPlaceholder'
import { OverviewKPIRow } from '../features/overview/OverviewKPIRow'
import { OverviewMLSummary } from '../features/overview/OverviewMLSummary'
import { OverviewRecentFeed } from '../features/overview/OverviewRecentFeed'
import { useShellFilters } from '../layout/useShellFilters'

export function OverviewHomePage() {
  const { timeRange, agentFilter } = useShellFilters()

  return (
    <div className="tt-dashboard">
      <header className="tt-dashboard__header">
        <h1 className="tt-page__title">Overview</h1>
        <p className="tt-dashboard__sub">
          Posture, activity, and model signals
          {timeRange !== 'custom' ? (
            <>
              {' '}
              · range <strong>{timeRange}</strong>
            </>
          ) : null}
          {agentFilter ? (
            <>
              {' '}
              · agent filter <strong>{agentFilter}</strong>
            </>
          ) : null}
        </p>
      </header>

      <OverviewKPIRow />
      <OverviewMLSummary />
      <OverviewChartsPlaceholder />
      <OverviewRecentFeed />
    </div>
  )
}
