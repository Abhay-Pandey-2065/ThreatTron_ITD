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
  type SandboxInvestigation,
  type SandboxScenario,
  type WorkflowAuditRecord,
} from '../lib/api'
import { DomainPageLayout } from '../shared/DomainPageLayout'
import { EmptyState } from '../shared/EmptyState'
import { ErrorRetry } from '../shared/ErrorRetry'

const SIMULATION_FACTORS = [
  'unusual_after_hours_activity',
  'high_volume_file_activity',
  'usb_activity',
  'external_network_activity',
  'suspicious_process_activity',
]

export function WorkflowSandboxPage() {
  const [cases, setCases] = useState<SandboxScenario[]>([])
  const [investigations, setInvestigations] = useState<SandboxInvestigation[]>([])
  const [audit, setAudit] = useState<WorkflowAuditRecord[]>([])
  const [riskScore, setRiskScore] = useState(55)
  const [factors, setFactors] = useState<string[]>([])
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(() => {
    setError(null)
    setLoading(true)
    Promise.all([fetchSandboxScenarios(), fetchSandboxInvestigations(), fetchSandboxAudit()])
      .then(([newCases, newInvestigations, newAudit]) => {
        setCases(newCases)
        setInvestigations(newInvestigations)
        setAudit(newAudit)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Unable to load sandbox data.'))
      .finally(() => setLoading(false))
  }, [])
  useEffect(reload, [reload])

  function toggleFactor(factor: string) {
    setFactors((current) => current.includes(factor) ? current.filter((value) => value !== factor) : [...current, factor])
  }

  async function runSimulation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await createSandboxScenario({ scenario: 'custom', risk_score: riskScore / 100, rules_triggered: factors })
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create simulation.')
    } finally {
      setBusy(false)
    }
  }

  async function perform(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the simulation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <DomainPageLayout title="Workflow Testing Sandbox" lead="Test detection triage and analyst review using isolated simulated records.">
      <div className="tt-simulation-banner"><strong>SIMULATION ONLY</strong><span>Sandbox records are stored separately and never enter production telemetry or alert tables.</span></div>
      {error && <ErrorRetry message={error} onRetry={reload} />}
      <form className="tt-soc-panel tt-sandbox-form" onSubmit={(event) => void runSimulation(event)}>
        <h2>Create simulated risk event</h2>
        <label className="tt-field"><span className="tt-field__label">Risk score: {riskScore}/100</span><input className="tt-input" type="range" min="0" max="100" value={riskScore} onChange={(event) => setRiskScore(Number(event.target.value))} /></label>
        <fieldset className="tt-sandbox-factors"><legend>Simulated rule signals</legend>{SIMULATION_FACTORS.map((factor) => <label key={factor}><input type="checkbox" checked={factors.includes(factor)} onChange={() => toggleFactor(factor)} /> {factor.replaceAll('_', ' ')}</label>)}</fieldset>
        <button className="tt-button tt-button--primary" type="submit" disabled={busy}>{busy ? 'Running…' : 'Run simulation'}</button>
        <p className="tt-dash__muted">The backend applies the same configured threshold and severity bands used for real detections.</p>
      </form>

      <section className="tt-sandbox-cases">
        <h2>Simulated detections</h2>
        {loading ? <div className="tt-empty-state"><p className="tt-empty-state__message">Loading sandbox…</p></div> :
          cases.length === 0 ? <EmptyState title="No simulations yet" message="Set a score and signals above, then run a simulation to test threshold triage." /> :
            cases.map((scenario) => <article className="tt-soc-panel tt-sandbox-case" key={scenario.id}>
              <header><div><span className="tt-simulation-label">SIMULATION CASE #{scenario.id}</span><h3>{scenario.title}</h3><p>{Math.round(scenario.risk_score * 100)}/100 · {scenario.is_threat ? 'Threat signal present' : 'No threat flag'} · {scenario.rules_triggered.length ? scenario.rules_triggered.join('; ') : 'No rule signals'}</p></div></header>
              <p className="tt-dash__muted">Created {new Date(scenario.created_at).toLocaleString()} · Technical agent: {scenario.agent_id}</p>
              {scenario.alert ? <div className="tt-sandbox-alert">
                <strong>{scenario.alert.severity.toUpperCase()} alert · {Math.round(scenario.alert.risk_score * 100)}/100 · {scenario.alert.status.replace('_', ' ')}</strong>
                <div className="tt-sandbox-actions">
                  <button className="tt-button" type="button" disabled={busy} onClick={() => void perform(() => updateSandboxAlert(scenario.alert!.id, 'investigating'))}>Mark investigating</button>
                  <button className="tt-button" type="button" disabled={busy} onClick={() => void perform(() => submitSandboxFeedback(scenario.alert!.id, 'false_positive', 'Analyst marked this simulated detection false positive.'))}>Record false positive</button>
                  <button className="tt-button" type="button" disabled={busy} onClick={() => void perform(() => submitSandboxFeedback(scenario.alert!.id, 'confirmed', 'Analyst confirmed this simulated detection.'))}>Confirm detection</button>
                  <button className="tt-button tt-button--primary" type="button" disabled={busy} onClick={() => void perform(() => createSandboxInvestigation(scenario.alert!.id))}>Open investigation</button>
                </div>
              </div> : <p className="tt-dash__muted">Below threshold: no alert was generated for this simulated event.</p>}
            </article>)}
      </section>

      <section className="tt-sandbox-cases">
        <h2>Simulated investigations</h2>
        {investigations.length ? investigations.map((investigation) => <article className="tt-soc-panel tt-sandbox-case" key={investigation.id}>
          <header><div><span className="tt-simulation-label">SIMULATION INVESTIGATION #{investigation.id}</span><h3>{investigation.title}</h3><p>Alert #{investigation.alert_id} · {investigation.status.replace('_', ' ')}</p></div>
            <select className="tt-select" value={investigation.status} disabled={busy} aria-label={`Simulation investigation ${investigation.id} status`} onChange={(event) => void perform(() => updateSandboxInvestigation(investigation.id, event.target.value as 'open' | 'in_progress' | 'resolved'))}>
              {['open', 'in_progress', 'resolved'].map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}
            </select>
          </header>
          <label className="tt-field"><span className="tt-field__label">Add analyst note</span><textarea className="tt-input tt-workflow-notes" rows={2} value={noteDraft[investigation.id] ?? ''} onChange={(event) => setNoteDraft((current) => ({ ...current, [investigation.id]: event.target.value }))} /></label>
          <button className="tt-button" type="button" disabled={busy || !noteDraft[investigation.id]?.trim()} onClick={() => void perform(async () => { await addSandboxInvestigationNote(investigation.id, noteDraft[investigation.id].trim()); setNoteDraft((current) => ({ ...current, [investigation.id]: '' })) })}>Add note</button>
          {investigation.notes.map((note) => <p key={note.id} className="tt-sandbox-note">{note.body}<span>{new Date(note.created_at).toLocaleString()} · Simulation</span></p>)}
          <h4>Investigation timeline</h4>
          {investigation.timeline.length ? <ul className="tt-workflow-list">{investigation.timeline.map((entry) => <li key={`${entry.entity_type}-${entry.id}`}><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.entity_type} #{entry.entity_id} · {entry.actor_email ?? 'Simulation actor'} · {new Date(entry.created_at).toLocaleString()} · Simulation</span></li>)}</ul> : <p className="tt-dash__muted">No simulation actions recorded yet.</p>}
        </article>) : <p className="tt-dash__muted">Open an investigation from a simulated alert to exercise analyst workflow.</p>}
      </section>

      <section className="tt-sandbox-cases">
        <h2>Simulation audit history</h2>
        {audit.length ? <ul className="tt-workflow-list">{audit.map((entry) => <li key={entry.id}><strong>{entry.action}</strong> · {entry.entity_type} #{entry.entity_id}<span>{entry.actor_email ?? 'Actor identity unavailable'} · {new Date(entry.created_at).toLocaleString()} · Simulation</span></li>)}</ul> : <p className="tt-dash__muted">Simulation actions will be recorded here.</p>}
      </section>
    </DomainPageLayout>
  )
}
