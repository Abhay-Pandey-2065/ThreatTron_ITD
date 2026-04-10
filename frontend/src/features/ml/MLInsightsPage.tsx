import { Link } from 'react-router-dom'
import { MLSandbox } from './MLSandbox'
import { MLLiveRiskGauge } from './MLLiveRiskGauge'
import { useShellFilters } from '../../layout/useShellFilters'

export function MLInsightsPage() {
  const { buildPath, agentFilter } = useShellFilters()

  return (
    <div className="tt-page tt-ml-page">
      <p className="tt-ml-page__back">
        <Link className="tt-link" to={buildPath('/overview')}>
          ← Overview
        </Link>
      </p>
      <h1 className="tt-page__title">ML / Insights</h1>

      <section className="tt-dash__section" aria-labelledby="ml-live-heading">
        <h2 id="ml-live-heading" className="tt-dash__h2">
          Live Threat Assessment
        </h2>
        <MLLiveRiskGauge agentId={agentFilter || "Global"} />
      </section>

      <section className="tt-dash__section" aria-labelledby="ml-sandbox-heading">
        <h2 id="ml-sandbox-heading" className="tt-dash__h2">
          Testing Sandbox
        </h2>
        <MLSandbox />
      </section>
    </div>
  )
}
