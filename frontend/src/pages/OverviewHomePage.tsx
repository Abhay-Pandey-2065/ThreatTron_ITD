import { OverviewActivityPanel } from '../features/overview/OverviewActivityPanel'
import { OverviewKPIRow } from '../features/overview/OverviewKPIRow'
import { OverviewMLSummary } from '../features/overview/OverviewMLSummary'
import { OverviewRecentFeed } from '../features/overview/OverviewRecentFeed'
import { OverviewTriage } from '../features/overview/OverviewTriage'
import { useShellFilters } from '../layout/useShellFilters'
import { rangeLabel } from '../shared/format'

export function OverviewHomePage() {
  const { timeRange, agentFilter } = useShellFilters()

  return (
    <div className="tt-dashboard">
      <header className="tt-dashboard__header">
        <h1 className="tt-page__title">Overview</h1>
        <p className="tt-dashboard__sub">
          {rangeLabel(timeRange)}
          {agentFilter ? <> · Agent {agentFilter}</> : null}
        </p>
      </header>

      <OverviewTriage />
      <OverviewKPIRow />
      <OverviewMLSummary />
      <OverviewActivityPanel />
      <OverviewRecentFeed />
    </div>
  )
}
