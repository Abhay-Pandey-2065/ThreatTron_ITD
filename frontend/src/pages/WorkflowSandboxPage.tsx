import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  addSandboxInvestigationNote,
  createSandboxInvestigation,
  createSandboxScenario,
  fetchSandboxAudit,
  fetchSandboxInvestigations,
  fetchSandboxScenarios,
  submitSandboxFeedback,
  updateSandboxAlert,
  updateSandboxInvestigation,
  type AlertStatus,
  type InvestigationStatus,
  type SandboxAlert,
  type SandboxInvestigation,
  type SandboxScenario,
  type WorkflowAuditRecord,
} from '../lib/api'
import { EmptyState } from '../shared/EmptyState'
import { ErrorRetry } from '../shared/ErrorRetry'
import { severityTone } from '../shared/severity'

/** Signals the simulator can switch on. Any selected signal raises an alert. */
const SIGNALS = [
  'unusual_after_hours_activity',
  'high_volume_file_activity',
  'usb_activity',
  'external_network_activity',
  'suspicious_process_activity',
]

/** Largest page the API returns in one call. */
const LIST_LIMIT = 200

const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  resolved: 'Resolved',
  false_positive: 'False positive',
}

const INVESTIGATION_STATUSES: InvestigationStatus[] = ['open', 'in_progress', 'resolved']

const INVESTIGATION_STATUS_LABELS: Record<InvestigationStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
}

type Verdict = 'false_positive' | 'confirmed'

const VERDICT_LABELS: Record<Verdict, string> = {
  false_positive: 'False positive',
  confirmed: 'Confirmed',
}

function humanize(value: string): string {
  return value.replaceAll('_', ' ')
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function formatWhen(value: string): string {
  const date = new Date(value)
  return isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function countLabel(count: number): string {
  return count >= LIST_LIMIT ? `Showing the latest ${LIST_LIMIT}` : `${count} total`
}

/**
 * The backend stores a confirmation as status "acknowledged" and a false positive as
 * status "false_positive". This page never sets "acknowledged" directly, so the status
 * is a reliable way to show the current verdict.
 */
function verdictOf(alert: SandboxAlert): Verdict | null {
  if (alert.status === 'false_positive' || alert.false_positive) return 'false_positive'
  if (alert.status === 'acknowledged') return 'confirmed'
  return null
}

export function WorkflowSandboxPage() {
  const [cases, setCases] = useState<SandboxScenario[]>([])
  const [investigations, setInvestigations] = useState<SandboxInvestigation[]>([])
  const [audit, setAudit] = useState<WorkflowAuditRecord[]>([])
  const [riskScore, setRiskScore] = useState(55)
  const [signals, setSignals] = useState<string[]>([])
  const [threatFlag, setThreatFlag] = useState(false)
  const [alertNotes, setAlertNotes] = useState<Record<number, string>>({})
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null)

  /** Fetches all three lists. Used on first load and after every change, without blanking the page. */
  const reload = useCallback(async () => {
    try {
      const [newCases, newInvestigations, newAudit] = await Promise.all([
        fetchSandboxScenarios(LIST_LIMIT),
        fetchSandboxInvestigations(LIST_LIMIT),
        fetchSandboxAudit(),
      ])
      setCases(newCases)
      setInvestigations(newInvestigations)
      setAudit(newAudit)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Unable to load sandbox data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  /**
   * Runs one change, then refreshes the lists. A failure keeps the message and stores the
   * same action, so Retry repeats the change instead of only reloading the lists.
   */
  async function runAction(action: () => Promise<unknown>, failureMessage: string) {
    setBusy(true)
    setActionError(null)
    setRetryAction(null)
    try {
      await action()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : failureMessage)
      setRetryAction(() => () => void runAction(action, failureMessage))
    } finally {
      setBusy(false)
    }
    await reload()
  }

  function toggleSignal(signal: string) {
    setSignals((current) =>
      current.includes(signal) ? current.filter((value) => value !== signal) : [...current, signal],
    )
  }

  function runSimulation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void runAction(
      () =>
        createSandboxScenario({
          scenario: 'custom',
          risk_score: riskScore / 100,
          rules_triggered: signals,
          is_threat: threatFlag,
        }),
      'Unable to run the simulation.',
    )
  }

  function clearAlertNote(id: number) {
    setAlertNotes((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function clearNoteDraft(id: number) {
    setNoteDraft((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  function submitVerdict(alert: SandboxAlert, verdict: Verdict) {
    const note = alertNotes[alert.id]?.trim()
    void runAction(async () => {
      await submitSandboxFeedback(alert.id, verdict, note || undefined)
      clearAlertNote(alert.id)
    }, 'Unable to record the verdict.')
  }

  function openInvestigation(alert: SandboxAlert) {
    void runAction(() => createSandboxInvestigation(alert.id), 'Unable to open an investigation.')
  }

  function saveInvestigationNote(investigation: SandboxInvestigation) {
    const body = noteDraft[investigation.id]?.trim()
    if (!body) return
    void runAction(async () => {
      await addSandboxInvestigationNote(investigation.id, body)
      clearNoteDraft(investigation.id)
    }, 'Unable to save the note.')
  }

  // Lookup from alert id to its investigation, so each alert shows at most one "Open" action.
  const investigationByAlert = new Map<number, SandboxInvestigation>()
  for (const investigation of investigations) {
    investigationByAlert.set(investigation.alert_id, investigation)
  }

  function renderAlert(alert: SandboxAlert) {
    const verdict = verdictOf(alert)
    const closed = alert.status === 'false_positive'
    const investigation = investigationByAlert.get(alert.id)
    const note = alertNotes[alert.id] ?? ''

    return (
      <div className="tt-sandbox-alert">
        <div className="tt-sandbox-alert__summary">
          <span className={`tt-severity tt-severity--${severityTone(alert.severity)}`}>{alert.severity}</span>
          <span>Status: {ALERT_STATUS_LABELS[alert.status]}</span>
          <span>Verdict: {verdict ? VERDICT_LABELS[verdict] : 'None yet'}</span>
        </div>

        {alert.feedback ? <p className="tt-sandbox-alert__note">Analyst note: {alert.feedback}</p> : null}

        <label className="tt-field">
          <span className="tt-field__label">Verdict note (optional)</span>
          <input
            className="tt-input"
            type="text"
            maxLength={2000}
            value={note}
            onChange={(event) => setAlertNotes((current) => ({ ...current, [alert.id]: event.target.value }))}
          />
        </label>

        <div className="tt-sandbox-actions">
          <button
            className="tt-button"
            type="button"
            disabled={busy || alert.status === 'investigating'}
            onClick={() => void runAction(() => updateSandboxAlert(alert.id, 'investigating'), 'Unable to update the alert.')}
          >
            Mark investigating
          </button>
          <button
            className="tt-button"
            type="button"
            disabled={busy || verdict === 'false_positive'}
            onClick={() => submitVerdict(alert, 'false_positive')}
          >
            Mark false positive
          </button>
          <button
            className="tt-button"
            type="button"
            disabled={busy || verdict === 'confirmed'}
            onClick={() => submitVerdict(alert, 'confirmed')}
          >
            Confirm detection
          </button>
          {investigation ? (
            <span className="tt-dash__muted">Investigation {investigation.id} already exists (see below).</span>
          ) : (
            <button
              className="tt-button tt-button--primary"
              type="button"
              disabled={busy || closed}
              onClick={() => openInvestigation(alert)}
            >
              Open investigation
            </button>
          )}
        </div>

        {closed ? (
          <p className="tt-dash__muted">This alert is marked false positive. Mark it investigating to reopen it.</p>
        ) : null}
      </div>
    )
  }

  function renderCase(scenario: SandboxScenario) {
    return (
      <article className="tt-soc-panel tt-sandbox-case" key={scenario.id}>
        <header className="tt-sandbox-case__head">
          <h3 className="tt-sandbox-case__title">Case {scenario.id}</h3>
          <p className="tt-sandbox-case__meta">
            Risk {Math.round(scenario.risk_score * 100)}/100 · Threat flag {scenario.is_threat ? 'set' : 'not set'} ·
            Signals: {scenario.rules_triggered.length ? scenario.rules_triggered.map(humanize).join(', ') : 'none'}
          </p>
          <p className="tt-dash__muted">Created {formatWhen(scenario.created_at)}</p>
        </header>

        {scenario.alert ? (
          renderAlert(scenario.alert)
        ) : (
          <p className="tt-dash__muted">No alert was raised for this run.</p>
        )}
      </article>
    )
  }

  function renderInvestigation(investigation: SandboxInvestigation) {
    const draft = noteDraft[investigation.id] ?? ''
    return (
      <article className="tt-soc-panel tt-sandbox-case" key={investigation.id}>
        <header className="tt-sandbox-case__head tt-sandbox-case__head--split">
          <div>
            <h3 className="tt-sandbox-case__title">Investigation {investigation.id}</h3>
            <p className="tt-sandbox-case__meta">
              Alert {investigation.alert_id}
              {investigation.alert
                ? ` · ${capitalize(investigation.alert.severity)} · ${ALERT_STATUS_LABELS[investigation.alert.status]}`
                : ''}
            </p>
          </div>
          <label className="tt-field tt-field--inline">
            <span className="tt-field__label">Status</span>
            <select
              className="tt-select"
              value={investigation.status}
              disabled={busy}
              onChange={(event) =>
                void runAction(
                  () => updateSandboxInvestigation(investigation.id, event.target.value as InvestigationStatus),
                  'Unable to update the investigation.',
                )
              }
            >
              {INVESTIGATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {INVESTIGATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </header>

        <h4 className="tt-sandbox-subhead">Notes</h4>
        {investigation.notes.length ? (
          <ul className="tt-workflow-list">
            {investigation.notes.map((note) => (
              <li key={note.id}>
                {note.body}
                <span>{formatWhen(note.created_at)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tt-dash__muted">No notes yet.</p>
        )}

        <label className="tt-field">
          <span className="tt-field__label">Add a note</span>
          <textarea
            className="tt-input tt-workflow-notes"
            rows={3}
            maxLength={10000}
            value={draft}
            onChange={(event) => setNoteDraft((current) => ({ ...current, [investigation.id]: event.target.value }))}
          />
        </label>
        <div className="tt-sandbox-actions">
          <button
            className="tt-button"
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => saveInvestigationNote(investigation)}
          >
            Save note
          </button>
        </div>

        <h4 className="tt-sandbox-subhead">Timeline</h4>
        {investigation.timeline.length ? (
          <ul className="tt-workflow-list">
            {investigation.timeline.map((entry) => (
              <li key={`${entry.entity_type}-${entry.id}`}>
                <strong>{capitalize(humanize(entry.action))}</strong>
                <span>
                  {humanize(entry.entity_type)} {entry.entity_id} · {entry.actor_email ?? 'Unknown user'} ·{' '}
                  {formatWhen(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tt-dash__muted">No actions recorded yet.</p>
        )}
      </article>
    )
  }

  return (
    <div className="tt-page tt-domain-page">
      <header className="tt-domain-page__header">
        <h1 className="tt-page__title">Workflow sandbox</h1>
        <p className="tt-domain-page__sub">
          Test detection and analyst review with simulated records. Nothing here reaches live telemetry or alerts.
        </p>
      </header>

      {loadError ? <ErrorRetry message={loadError} onRetry={() => void reload()} /> : null}
      {actionError ? (
        <ErrorRetry
          message={actionError}
          onRetry={() => {
            if (retryAction) retryAction()
            else setActionError(null)
          }}
        />
      ) : null}

      <form className="tt-soc-panel tt-sandbox-form" onSubmit={runSimulation}>
        <h2 className="tt-sandbox-heading">New simulated event</h2>

        <label className="tt-field">
          <span className="tt-field__label">Risk score: {riskScore} / 100</span>
          <input
            className="tt-sandbox-range"
            type="range"
            min={0}
            max={100}
            value={riskScore}
            onChange={(event) => setRiskScore(Number(event.target.value))}
          />
        </label>

        <fieldset className="tt-sandbox-factors">
          <legend>Signals</legend>
          <p className="tt-dash__muted">Each selected signal raises an alert, even when the score is low.</p>
          <div className="tt-sandbox-checks">
            {SIGNALS.map((signal) => (
              <label className="tt-check" key={signal}>
                <input type="checkbox" checked={signals.includes(signal)} onChange={() => toggleSignal(signal)} />
                <span>{capitalize(humanize(signal))}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="tt-check">
          <input type="checkbox" checked={threatFlag} onChange={(event) => setThreatFlag(event.target.checked)} />
          <span>Set threat flag</span>
        </label>
        <p className="tt-dash__muted">A threat flag raises the severity to at least medium.</p>

        <div className="tt-sandbox-form-actions">
          <button className="tt-button tt-button--primary" type="submit" disabled={busy}>
            {busy ? 'Running…' : 'Run simulation'}
          </button>
        </div>
      </form>

      <section className="tt-sandbox-section" aria-labelledby="sandbox-cases-heading">
        <div className="tt-sandbox-section__head">
          <h2 id="sandbox-cases-heading" className="tt-sandbox-section__title">
            Simulated detections
          </h2>
          {!loading && cases.length > 0 ? <span className="tt-dash__muted">{countLabel(cases.length)}</span> : null}
        </div>
        {loading ? (
          <p className="tt-dash__muted">Loading sandbox…</p>
        ) : cases.length === 0 ? (
          <EmptyState
            title="No simulations yet"
            message="Set a risk score and signals above, then run a simulation to see how triage handles it."
          />
        ) : (
          cases.map(renderCase)
        )}
      </section>

      <section className="tt-sandbox-section" aria-labelledby="sandbox-investigations-heading">
        <div className="tt-sandbox-section__head">
          <h2 id="sandbox-investigations-heading" className="tt-sandbox-section__title">
            Simulated investigations
          </h2>
          {!loading && investigations.length > 0 ? (
            <span className="tt-dash__muted">{countLabel(investigations.length)}</span>
          ) : null}
        </div>
        {!loading && investigations.length === 0 ? (
          <p className="tt-dash__muted">Open an investigation from a simulated alert to exercise the analyst workflow.</p>
        ) : (
          investigations.map(renderInvestigation)
        )}
      </section>

      <section className="tt-sandbox-section" aria-labelledby="sandbox-audit-heading">
        <div className="tt-sandbox-section__head">
          <h2 id="sandbox-audit-heading" className="tt-sandbox-section__title">
            Audit history
          </h2>
        </div>
        {audit.length ? (
          <ul className="tt-workflow-list">
            {audit.map((entry) => (
              <li key={entry.id}>
                <strong>{capitalize(humanize(entry.action))}</strong>
                <span>
                  {humanize(entry.entity_type)} {entry.entity_id} · {entry.actor_email ?? 'Unknown user'} ·{' '}
                  {formatWhen(entry.created_at)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="tt-dash__muted">Actions taken in the sandbox will appear here.</p>
        )}
      </section>
    </div>
  )
}
