export function DomainPlaceholderPage({ title }: { title: string }) {
  return (
    <div className="tt-page">
      <h1 className="tt-page__title">{title}</h1>
      <p className="tt-page__lead">
        This section is scaffolded for the ThreatTron console. Hook up read APIs for{' '}
        {title.toLowerCase()} events to replace this placeholder.
      </p>
    </div>
  )
}
