export function OverviewChartsPlaceholder() {
  return (
    <section className="tt-dash__section" aria-labelledby="charts-heading">
      <h2 id="charts-heading" className="tt-dash__h2">
        Activity & system
      </h2>
      <div className="tt-chart-placeholder">
        <p className="tt-dash__muted">
          Event volume over time and CPU / memory charts will render here when time-series endpoints
          are available.
        </p>
      </div>
    </section>
  )
}
