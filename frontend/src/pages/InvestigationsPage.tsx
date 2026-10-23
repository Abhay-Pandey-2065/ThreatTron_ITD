import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addInvestigationNote,
  fetchInvestigation,
  fetchInvestigations,
  updateInvestigation,
  type InvestigationRecord,
  type InvestigationStatus,
} from '../lib/api'
import { DomainPageLayout } from '../shared/DomainPageLayout'
import { EmptyState } from '../shared/EmptyState'
import { ErrorRetry } from '../shared/ErrorRetry'
import { formatAbsoluteUtc } from '../shared/format'
import { ALERT_STATUS_LABELS, INVESTIGATION_STATUS_LABELS } from '../shared/labels'
import { severityTone } from '../shared/severity'

const STATUSES: InvestigationStatus[] = ['open', 'in_progress', 'resolved']

function scoreOf(risk: number): string {
  return `${Math.round(risk * 100)} of 100`
}

export function InvestigationsPage() {
  const { investigationId } = useParams()
  const [items, setItems] = useState<InvestigationRecord[]>([])
  const [selected, setSelected] = useState<InvestigationRecord | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /** Loads the list or the open case. Keeps the current view on screen while it refreshes. */
  const reload = useCallback(async () => {
    setError(null)
    try {
      if (investigationId) {
        setSelected(await fetchInvestigation(investigationId))
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

  useEffect(() => {
    void reload()
  }, [reload])

  async function saveStatus(status: InvestigationStatus) {
    if (!investigationId) return
    setSaving(true)
    setError(null)
    try {
      setSelected(await updateInvestigation(investigationId, { status }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the status.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNote() {
    const body = noteDraft.trim()
    if (!investigationId || !selected || !body) return
    setSaving(true)
    setError(null)
    try {
      await addInvestigationNote(selected.id, body)
      setNoteDraft('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the note.')
    } finally {
      setSaving(false)
    }
  }

  function renderDetail(record: InvestigationRecord) {
    const alert = record.alert
    const evidence = alert?.evidence_refs ?? []
    return (
      <div className="tt-workflow-layout">
        <p className="tt-workflow-layout__back">
          <Link className="tt-link" to="/investigations">
            Back to investigations
          </Link>
        </p>

        <section className="tt-soc-panel">
          <h2>Details</h2>
          <dl className="tt-ml-meta">
            <div>
              <dt>Alert</dt>
              <dd>{alert?.title ?? `Alert ${record.alert_id}`}</dd>
            </div>
            <div>
              <dt>Severity</dt>
              <dd>
                {alert ? (
                  <span className={`tt-severity tt-severity--${severityTone(alert.severity)}`}>{alert.severity}</span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Risk</dt>
              <dd>{alert ? scoreOf(alert.risk_score) : '—'}</dd>
            </div>
            <div>
              <dt>Agent</dt>
              <dd className="tt-mono">{alert?.agent_id ?? '—'}</dd>
            </div>
            <div>
              <dt>Alert status</dt>
              <dd>{alert ? ALERT_STATUS_LABELS[alert.status] : '—'}</dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd className="tt-mono">{formatAbsoluteUtc(record.created_at)}</dd>
            </div>
          </dl>

          <label className="tt-field">
            <span className="tt-field__label">Investigation status</span>
            <select
              className="tt-select"
              value={record.status}
              disabled={saving}
              onChange={(event) => void saveStatus(event.target.value as InvestigationStatus)}
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {INVESTIGATION_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="tt-soc-panel">
          <h2>Evidence</h2>
          {evidence.length ? (
            <ul className="tt-workflow-list">
              {evidence.map((ref) => (
                <li key={`${ref.type}-${ref.id}`}>
                  <strong>{ref.type}</strong> event #{ref.id}
                </li>
              ))}
            </ul>
          ) : (
            <p className="tt-dash__muted">No linked evidence.</p>
          )}
        </section>

        <section className="tt-soc-panel tt-workflow-layout__wide">
          <h2>Notes</h2>
          {record.notes.length ? (
            <ul className="tt-workflow-list">
              {record.notes.map((note) => (
                <li key={note.id}>
                  {note.body}
                  <span>{formatAbsoluteUtc(note.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tt-dash__muted">No notes yet.</p>
          )}

          <label className="tt-field">
            <span className="tt-field__label">Add note</span>
            <textarea
              className="tt-input tt-workflow-notes"
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              maxLength={10000}
              rows={4}
            />
          </label>
          <div className="tt-sandbox-actions">
            <button
              className="tt-button tt-button--primary"
              type="button"
              disabled={saving || !noteDraft.trim()}
              onClick={() => void saveNote()}
            >
              {saving ? 'Saving…' : 'Save note'}
            </button>
          </div>
        </section>

        <section className="tt-soc-panel tt-workflow-layout__wide">
          <h2>Timeline</h2>
          {record.timeline.length ? (
            <ul className="tt-workflow-list">
              {record.timeline.map((entry) => (
                <li key={`${entry.entity_type}-${entry.id}`}>
                  <strong>{entry.action.replaceAll('_', ' ')}</strong>
                  <span>
                    {entry.actor_email ?? 'Unknown user'} · {formatAbsoluteUtc(entry.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="tt-dash__muted">No actions recorded yet.</p>
          )}
        </section>
      </div>
    )
  }

  function renderList() {
    return (
      <div className="tt-table-wrap">
        <table className="tt-table">
          <thead>
            <tr>
              <th>Investigation</th>
              <th>Alert</th>
              <th>Severity</th>
              <th className="tt-num">Risk</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link className="tt-link" to={`/investigations/${item.id}`}>
                    {item.title}
                  </Link>
                </td>
                <td>{item.alert?.title ?? `Alert ${item.alert_id}`}</td>
                <td>
                  {item.alert ? (
                    <span className={`tt-severity tt-severity--${severityTone(item.alert.severity)}`}>
                      {item.alert.severity}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="tt-num">{item.alert ? Math.round(item.alert.risk_score * 100) : '—'}</td>
                <td>{INVESTIGATION_STATUS_LABELS[item.status]}</td>
                <td className="tt-mono tt-table-cell--nowrap">{formatAbsoluteUtc(item.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  let body: React.ReactNode
  if (loading) {
    body = (
      <div className="tt-empty-state">
        <p className="tt-empty-state__message">Loading investigations…</p>
      </div>
    )
  } else if (investigationId) {
    body = selected ? (
      renderDetail(selected)
    ) : error ? null : (
      <EmptyState title="Investigation not found" message="It may have been removed, or the link is wrong." />
    )
  } else if (items.length) {
    body = renderList()
  } else {
    body = (
      <EmptyState
        title="No investigations yet"
        message="Open an investigation from an alert to start working on it. Every action is kept in the audit history."
      />
    )
  }

  return (
    <DomainPageLayout
      title="Investigations"
      lead="Review linked alerts and evidence. Every change is recorded in the audit history."
    >
      {error ? <ErrorRetry message={error} onRetry={() => void reload()} /> : null}
      {body}
    </DomainPageLayout>
  )
}
