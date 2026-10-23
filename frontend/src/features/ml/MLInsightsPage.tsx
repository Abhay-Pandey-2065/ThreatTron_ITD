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
          Back to overview
        </Link>
      </p>
      <header className="tt-domain-page__header">
        <h1 className="tt-page__title">ML insights</h1>
        <p className="tt-domain-page__sub">
          Model scores for {agentFilter ? `agent ${agentFilter}` : 'all agents'}. Scores update automatically.
        </p>
      </header>

      <section className="tt-dash__section tt-ml-section" aria-labelledby="ml-live-heading">
        <h2 id="ml-live-heading" className="tt-dash__h2">
          Live risk
        </h2>
        <MLLiveRiskGauge agentId={agentFilter || 'Global'} />
      </section>

      <section className="tt-dash__section tt-ml-section" aria-labelledby="ml-sandbox-heading">
        <h2 id="ml-sandbox-heading" className="tt-dash__h2">
          Scenario tester
        </h2>
        <p className="tt-dash__muted">
          Enter behaviour counts for an employee to see how the models score them. Nothing is saved.
        </p>
        <MLSandbox />
      </section>
    </div>
  )
}
