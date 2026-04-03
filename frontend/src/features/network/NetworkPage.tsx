import { DomainPageLayout } from '../../shared/DomainPageLayout'
import { EmptyState } from '../../shared/EmptyState'

export function NetworkPage() {
  return (
    <DomainPageLayout
      title="Network"
      lead="Ethical network telemetry: hashes, ports, status. No payload capture."
    >
      <p className="tt-dash__muted" style={{ marginBottom: '1.25rem', maxWidth: '40rem' }}>
        When Network-Agent data is integrated, this page will show connection hashes, ports, and status
        metadata. Content and payloads are never captured. All telemetry is anonymized where possible.
      </p>
      <EmptyState
        title="Network data not yet integrated"
        message="Integrate Network-Agent read APIs to show connection metadata, port usage, and status here. Use ethical collection practices: hashes and ports only, no payload capture."
      />
    </DomainPageLayout>
  )
}
