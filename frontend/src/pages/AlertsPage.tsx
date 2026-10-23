import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createInvestigation,
  fetchSecurityAlerts,
  submitSecurityFeedback,
  updateSecurityAlertStatus,
  type AlertStatus,
  type SecurityAlert,
} from '../lib/api'
import { DomainPageLayout } from '../shared/DomainPageLayout'
import { Drawer } from '../shared/Drawer'
import { EmptyState } from '../shared/EmptyState'
import { ErrorRetry } from '../shared/ErrorRetry'
import { formatAbsoluteUtc, formatRelative } from '../shared/format'
import { ALERT_STATUS_LABELS } from '../shared/labels'
import { severityTone, type SeverityTone } from '../shared/severity'

const STATUSES: AlertStatus[] = ['open', 'acknowledged', 'investigating', 'resolved', 'false_positive']

/** Risk score is 0–1 from the API; the bar colour follows the same thresholds as severity. */
function riskTone(score: number): SeverityTone {
  if (score >= 0.8) return 'critical'
  if (score >= 0.5) return 'warn'
  return 'info'
}

export function AlertsPage() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState<SecurityAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  /** Refreshes the list without blanking it. */
  const refresh = useCallback(async () => {
    try {
      setAlerts(await fetchSecurityAlerts())
      setError(null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load alerts.')
    }
  }, [])

  useEffect(() => {
    void refresh().finally(() => setLoading(false))
  }, [refresh])

  const selected = alerts.find((alert) => alert.id === selectedId) ?? null

  const closeDrawer = useCallback(() => {
    setSelectedId(null)
    setNote('')
  }, [])

  function openDrawer(alert: SecurityAlert) {
    setSelectedId(alert.id)
    setNote('')
  }

  async function act(action: () => Promise<unknown>, failureMessage: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : failureMessage)
    } finally {
      setBusy(false)
    }
    await refresh()
  }

  function changeStatus(alert: SecurityAlert, status: AlertStatus) {
    void act(() => updateSecurityAlertStatus(alert.id, status), 'Unable to update the alert status.')
  }

  function submitVerdict(alert: SecurityAlert, verdict: 'false_positive' | 'confirmed') {
    void act(async () => {
      await submitSecurityFeedback(alert.id, verdict, note.trim() || undefined)
      setNote('')
    }, 'Unable to record your verdict.')
  }

  async function investigate(alert: SecurityAlert) {
    setBusy(true)
    setError(null)
    try {
      const investigation = await createInvestigation(alert.id)
      navigate(`/investigations/${investigation.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to open an investigation.')
      setBusy(false)
    }
  }

  return (
    <DomainPageLayout title="Alerts" lead="Alerts raised from telemetry that crossed the risk threshold.">
      {error ? <ErrorRetry message={error} onRetry={() => void refresh()} /> : null}

      {loading ? (
        <div className="tt-empty-state">
          <p className="tt-empty-state__message">Loading alerts…</p>
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState
          title="No alerts"
          message="Alerts appear here when telemetry crosses the risk threshold."
        />
      ) : (
        <div className="tt-table-wrap">
          <table className="tt-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Alert</th>
                <th className="tt-num">Risk</th>
                <th>Status</th>
                <th>Created</th>
                <th>
                  <span className="tt-visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => {
                const tone = severityTone(alert.severity)
                const risk = riskTone(alert.risk_score)
                const riskPct = Math.round(alert.risk_score * 100)
                return (
                  <tr key={alert.id} className={`tt-row--${tone}`}>
                    <td>
                      <span className={`tt-severity tt-severity--${tone}`}>{alert.severity}</span>
                    </td>
                    <td>
                      <button type="button" className="tt-alert-title" onClick={() => openDrawer(alert)}>
                        {alert.title}
                      </button>
                      <div className="tt-table-cell--muted tt-mono">{alert.agent_id}</div>
                    </td>
                    <td className="tt-num">
                      <span className="tt-riskbar" title={`Risk ${riskPct} of 100`}>
                        <span className="tt-riskbar__track">
                          <span
                            className={`tt-riskbar__fill tt-riskbar__fill--${risk}`}
                            style={{ width: `${Math.min(100, Math.max(0, riskPct))}%` }}
                          />
                        </span>
                        <span className="tt-riskbar__value">{riskPct}</span>
                      </span>
                    </td>
                    <td>{ALERT_STATUS_LABELS[alert.status]}</td>
                    <td className="tt-mono tt-table-cell--nowrap" title={formatAbsoluteUtc(alert.created_at)}>
                      {formatRelative(alert.created_at)}
                    </td>
                    <td>
                      <button type="button" className="tt-button" onClick={() => openDrawer(alert)}>
                        Review
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Drawer open={selected !== null} onClose={closeDrawer} title={selected ? selected.title : 'Alert'}>
        {selected ? (
          <>
            <dl className="tt-ml-meta">
              <div>
                <dt>Severity</dt>
                <dd>
                  <span className={`tt-severity tt-severity--${severityTone(selected.severity)}`}>
                    {selected.severity}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Risk</dt>
                <dd>{Math.round(selected.risk_score * 100)} of 100</dd>
              </div>
              <div>
                <dt>Agent</dt>
                <dd className="tt-mono">{selected.agent_id}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{ALERT_STATUS_LABELS[selected.status]}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd className="tt-mono">{formatAbsoluteUtc(selected.created_at)}</dd>
              </div>
              <div>
                <dt>Last seen</dt>
                <dd className="tt-mono">{formatAbsoluteUtc(selected.last_seen_at)}</dd>
              </div>
              <div>
                <dt>Analyst note</dt>
                <dd>{selected.feedback ? selected.feedback : 'None'}</dd>
              </div>
            </dl>

            <h3 className="tt-drawer__sub">Evidence</h3>
            {selected.evidence_refs.length ? (
              <ul className="tt-ml-linked">
                {selected.evidence_refs.map((ref) => (
                  <li key={`${ref.type}-${ref.id}`}>
                    {ref.type} event #{ref.id}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="tt-dash__muted">No linked evidence.</p>
            )}

            <h3 className="tt-drawer__sub">Status</h3>
            <label className="tt-field">
              <span className="tt-field__label">Change status</span>
              <select
                className="tt-select"
                value={selected.status}
                disabled={busy}
                onChange={(event) => changeStatus(selected, event.target.value as AlertStatus)}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {ALERT_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </label>

            <h3 className="tt-drawer__sub">Triage</h3>
            <label className="tt-field">
              <span className="tt-field__label">Note (optional)</span>
              <input
                className="tt-input"
                type="text"
                maxLength={2000}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="tt-drawer__actions">
              <button
                className="tt-button tt-button--primary"
                type="button"
                disabled={busy}
                onClick={() => void investigate(selected)}
              >
                Open investigation
              </button>
              <button
                className="tt-button"
                type="button"
                disabled={busy}
                onClick={() => submitVerdict(selected, 'false_positive')}
              >
                Mark false positive
              </button>
              <button
                className="tt-button"
                type="button"
                disabled={busy}
                onClick={() => submitVerdict(selected, 'confirmed')}
              >
                Confirm
              </button>
            </div>
          </>
        ) : null}
      </Drawer>
    </DomainPageLayout>
  )
}
