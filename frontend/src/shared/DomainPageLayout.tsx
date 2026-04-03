import { useShellFilters } from '../layout/useShellFilters'

interface DomainPageLayoutProps {
  title: string
  lead?: string
  children: React.ReactNode
}

export function DomainPageLayout({ title, lead, children }: DomainPageLayoutProps) {
  const { timeRange, agentFilter } = useShellFilters()

  return (
    <div className="tt-page tt-domain-page">
      <header className="tt-domain-page__header">
        <h1 className="tt-page__title">{title}</h1>
        {(lead || timeRange || agentFilter) && (
          <p className="tt-domain-page__sub">
            {lead}
            {timeRange !== 'custom' && (
              <>
                {' '}
                · range <strong>{timeRange}</strong>
              </>
            )}
            {agentFilter && (
              <>
                {' '}
                · agent <strong>{agentFilter}</strong>
              </>
            )}
          </p>
        )}
      </header>
      {children}
    </div>
  )
}
