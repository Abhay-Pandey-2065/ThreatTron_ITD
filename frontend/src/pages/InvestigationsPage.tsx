import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addInvestigationNote, fetchInvestigation, fetchInvestigations, updateInvestigation, type InvestigationRecord, type InvestigationStatus } from '../lib/api'
import { DomainPageLayout } from '../shared/DomainPageLayout'
import { EmptyState } from '../shared/EmptyState'
import { ErrorRetry } from '../shared/ErrorRetry'

const STATUSES: InvestigationStatus[] = ['open', 'in_progress', 'resolved']

export function InvestigationsPage() {
  const { investigationId } = useParams()
  const [items, setItems] = useState<InvestigationRecord[]>([])
  const [selected, setSelected] = useState<InvestigationRecord | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (investigationId) {
        const record = await fetchInvestigation(investigationId)
        setSelected(record)
      } else {
        setItems(await fetchInvestigations())
        setSelected(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load investigations.')
    } finally {
      setLoading(false)
    }
  }, [investigationId])
  useEffect(() => { void reload() }, [reload])

  async function saveStatus(status: InvestigationStatus) {
    if (!investigationId) return
    setSaving(true)
    setError(null)
    try {
      const next = await updateInvestigation(investigationId, { status })
      setSelected(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save investigation changes.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNote() {
    if (!investigationId || !selected || !noteDraft.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addInvestigationNote(selected.id, noteDraft.trim())
      setNoteDraft('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save investigation note.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DomainPageLayout title="Investigations" lead="Review linked alerts and telemetry evidence; analyst actions are retained in the audit history.">
      {error && <ErrorRetry message={error} onRetry={() => void reload()} />}
      {loading ? <div className="tt-empty-state"><p className="tt-empty-state__message">Loading investigations…</p></div> :
        investigationId && selected ? <div className="tt-workflow-layout">
          <section className="tt-soc-panel">
            <h2>Investigation details</h2>
            <dl>
              <div><dt>Alert</dt><dd>{selected.alert_id}</dd></div>
              <div><dt>Severity</dt><dd>{selected.alert?.severity ?? 'Not available'}</dd></div>
              <div><dt>Risk score</dt><dd>{selected.alert ? `${Math.round(selected.alert.risk_score * 100)}/100` : 'Not available'}</dd></div>
              <div><dt>Alert</dt><dd>{selected.alert?.title ?? 'Not available'}</dd></div>
              <div><dt>Technical agent</dt><dd>{selected.alert?.agent_id ?? 'Not available'}</dd></div>
              <div><dt>Evidence references</dt><dd>{selected.alert?.evidence_refs?.length ? selected.alert.evidence_refs.map((ref) => `${ref.type} #${ref.id}`).join('; ') : 'Not available'}</dd></div>
              <div><dt>Created</dt><dd>{new Date(selected.created_at).toLocaleString()}</dd></div>
            </dl>
            <label className="tt-field"><span className="tt-field__label">Investigation status</span>
              <select className="tt-select" value={selected.status} disabled={saving} onChange={(event) => void saveStatus(event.target.value as InvestigationStatus)}>{STATUSES.map((status) => <option key={status} value={status}>{status.replace('_', ' ')}</option>)}</select>
            </label>
            <label className="tt-field"><span className="tt-field__label">Add analyst note</span>
              <textarea className="tt-input tt-workflow-notes" value={noteDraft} onChange={(event) => setNoteDraft(event.target.value)} maxLength={10000} rows={5} />
            </label>
            <button className="tt-button tt-button--primary" type="button" disabled={saving || !noteDraft.trim()} onClick={() => void saveNote()}>{saving ? 'Saving…' : 'Add note'}</button>
            <h3>Investigation notes</h3>
            {selected.notes.length ? <ul className="tt-workflow-list">{selected.notes.map((note) => <li key={note.id}>{note.body}<span>{new Date(note.created_at).toLocaleString()}</span></li>)}</ul> : <p>No notes recorded.</p>}
          </section>
          <section className="tt-soc-panel">
            <h2>Evidence references</h2>
            {selected.alert?.evidence_refs?.length ? <ul className="tt-workflow-list">{selected.alert.evidence_refs.map((evidence) => <li key={`${evidence.type}-${evidence.id}`}><strong>{evidence.type}</strong> event #{evidence.id}</li>)}</ul> : <p>No associated telemetry evidence references were returned.</p>}
            <h2>Investigation timeline</h2>
            {selected.timeline.length ? <ul className="tt-workflow-list">{selected.timeline.map((entry) => <li key={`${entry.entity_type}-${entry.id}`}><strong>{entry.action.replaceAll('_', ' ')}</strong><span>{entry.entity_type} #{entry.entity_id} · {entry.actor_email ?? 'Analyst identity unavailable'} · {new Date(entry.created_at).toLocaleString()}</span></li>)}</ul> : <p>No audit actions have been recorded.</p>}
          </section>
          <p><Link className="tt-link" to="/alerts">Back to alerts</Link></p>
        </div> : items.length ? <div className="tt-table-wrap"><table className="tt-table">
          <thead><tr><th>Investigation</th><th>Alert</th><th>Severity</th><th>Risk</th><th>Status</th><th>Updated</th></tr></thead>
          <tbody>{items.map((item) => <tr key={item.id}>
            <td><Link className="tt-link" to={`/investigations/${item.id}`}>{item.title}</Link></td>
            <td>{item.alert?.title || item.alert_id}</td>
            <td>{item.alert?.severity || 'Not available'}</td>
            <td>{item.alert ? `${Math.round(item.alert.risk_score * 100)}/100` : 'Not available'}</td>
            <td>{item.status}</td>
            <td>{new Date(item.updated_at).toLocaleString()}</td>
          </tr>)}</tbody>
        </table></div> : <EmptyState title="No investigations yet" message="Create an investigation from a persisted alert. Investigation records and analyst actions are kept in the backend audit history." />}
    </DomainPageLayout>
  )
}
