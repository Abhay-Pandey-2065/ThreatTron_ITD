import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createInvestigation, fetchSecurityAlerts, submitSecurityFeedback, updateSecurityAlertStatus, type AlertStatus, type SecurityAlert } from '../lib/api'
import { DomainPageLayout } from '../shared/DomainPageLayout'
import { EmptyState } from '../shared/EmptyState'
import { ErrorRetry } from '../shared/ErrorRetry'

const STATUSES: AlertStatus[] = ['open', 'acknowledged', 'investigating', 'resolved', 'false_positive']

export function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setError(null)
    setLoading(true)
    fetchSecurityAlerts().then(setAlerts).catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load alerts.')).finally(() => setLoading(false))
  }, [])
  useEffect(reload, [reload])

  async function changeStatus(alert: SecurityAlert, status: AlertStatus) {
    setBusyId(String(alert.id))
    setError(null)
    try {
      const updated = await updateSecurityAlertStatus(alert.id, status)
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update alert status.')
    } finally {
      setBusyId(null)
    }
  }

  async function investigate(alert: SecurityAlert) {
    setBusyId(String(alert.id))
    setError(null)
    try {
      const investigation = await createInvestigation(alert.id)
      navigate(`/investigations/${investigation.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create investigation.')
    } finally {
      setBusyId(null)
    }
  }

  async function markFeedback(alert: SecurityAlert, verdict: 'false_positive' | 'confirmed') {
    setBusyId(String(alert.id))
    setError(null)
    try {
      const updated = await submitSecurityFeedback(alert.id, verdict, feedback[alert.id])
      setAlerts((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record analyst feedback.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <DomainPageLayout title="Alerts" lead="Review risk detections based on existing telemetry and scoring.">
      {error && <ErrorRetry message={error} onRetry={reload} />}
      {loading ? <div className="tt-empty-state"><p className="tt-empty-state__message">Loading alerts…</p></div> :
        alerts.length === 0 ? <EmptyState title="No alerts to review" message="Alerts appear here when real telemetry crosses the configured risk threshold." /> :
          <div className="tt-table-wrap"><table className="tt-table">
            <thead><tr><th>Severity</th><th>Risk</th><th>User / endpoint</th><th>Why flagged</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{alerts.map((alert) => <tr key={alert.id}>
              <td><span className="tt-severity">{alert.severity.toUpperCase()}</span></td>
              <td>{Math.round(alert.risk_score * 100)}/100</td>
              <td><strong>{alert.title}</strong><br /><span className="tt-table-cell--muted">Technical agent: {alert.agent_id}</span></td>
              <td>{alert.evidence_refs.length ? alert.evidence_refs.map((ref) => `${ref.type} #${ref.id}`).join('; ') : 'Evidence references unavailable'}</td>
              <td>{new Date(alert.created_at).toLocaleString()}</td>
              <td><select className="tt-select" aria-label={`Status for alert ${alert.id}`} value={alert.status} disabled={busyId === String(alert.id)} onChange={(event) => void changeStatus(alert, event.target.value as AlertStatus)}>{STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select></td>
              <td><div className="tt-alert-actions"><button className="tt-button tt-button--primary" type="button" disabled={busyId === String(alert.id)} onClick={() => void investigate(alert)}>Investigate</button><input className="tt-input tt-input--compact" aria-label="Feedback note" placeholder="Feedback note" value={feedback[alert.id] ?? ''} onChange={(event) => setFeedback((current) => ({ ...current, [alert.id]: event.target.value }))} /><button className="tt-button" type="button" disabled={busyId === String(alert.id)} onClick={() => void markFeedback(alert, 'false_positive')}>False positive</button><button className="tt-button" type="button" disabled={busyId === String(alert.id)} onClick={() => void markFeedback(alert, 'confirmed')}>Confirm</button></div></td>
            </tr>)}</tbody>
          </table></div>}
    </DomainPageLayout>
  )
}
