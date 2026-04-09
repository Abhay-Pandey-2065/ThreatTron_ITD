import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  fetchEmailEvents,
  fetchFileEvents,
  fetchNetworkEvents,
  fetchOverviewStats,
  fetchProcessEvents,
  fetchSystemEvents,
  fetchUSBEvents,
  type EmailEventRow,
  type FileEventRow,
  type NetworkEventRow,
  type ProcessEventRow,
  type SystemEventRow,
  type USBEventRow,
} from '../lib/api'
import { ErrorRetry } from '../shared/ErrorRetry'

type LookupData = {
  statsTotal: number
  files: FileEventRow[]
  processes: ProcessEventRow[]
  systems: SystemEventRow[]
  emails: EmailEventRow[]
  usb: USBEventRow[]
  network: NetworkEventRow[]
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

export function AdminHomePage() {
  const [agentId, setAgentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<LookupData | null>(null)

  const canSearch = agentId.trim().length > 0 && !loading

  const load = async (targetAgentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const q = { time_range: '7d', agent_id: targetAgentId, limit: 100 }
      const [stats, files, processes, systems, emails, usb, network] = await Promise.all([
        fetchOverviewStats({ time_range: '7d', agent_id: targetAgentId }),
        fetchFileEvents(q),
        fetchProcessEvents(q),
        fetchSystemEvents(q),
        fetchEmailEvents(q),
        fetchUSBEvents(q),
        fetchNetworkEvents(q),
      ])

      const total = stats?.total_events ?? 0
      setData({
        statsTotal: total,
        files,
        processes,
        systems,
        emails,
        usb,
        network,
      })

      if (total === 0) {
        setError('No database records found for this credential (agent_id).')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load user telemetry.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = agentId.trim()
    if (!trimmed) {
      setError('Enter a valid user credential (agent_id).')
      return
    }
    void load(trimmed)
  }

  const rows = useMemo(() => {
    if (!data) return []
    return [
      { name: 'Files', count: data.files.length },
      { name: 'Processes', count: data.processes.length },
      { name: 'System', count: data.systems.length },
      { name: 'Email', count: data.emails.length },
      { name: 'USB', count: data.usb.length },
      { name: 'Network', count: data.network.length },
    ]
  }, [data])

  return (
    <div className="tt-page">
      <h1 className="tt-page__title">Admin</h1>
      <p className="tt-page__lead">
        Lookup a specific user credential (<code className="tt-inline-code">agent_id</code>) and load that
        user&apos;s telemetry directly from the database-backed APIs.
      </p>

      <form onSubmit={onSubmit} style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', marginTop: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        <label className="tt-filter" style={{ minWidth: '20rem' }}>
          <span className="tt-filter__label">User credential (agent_id)</span>
          <input
            className="tt-input"
            type="text"
            placeholder="agent-xxxxxxxx"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
        </label>
        <button type="submit" className="tt-button tt-button--primary" disabled={!canSearch}>
          {loading ? 'Loading…' : 'Load User Data'}
        </button>
      </form>

      {error ? <ErrorRetry message={error} onRetry={() => void load(agentId.trim())} /> : null}

      {data ? (
        <>
          <section className="tt-dash__section" style={{ marginTop: '1rem' }}>
            <h2 className="tt-dash__h2">Summary (last 7d)</h2>
            <p className="tt-dash__muted" style={{ marginBottom: '0.75rem' }}>
              Total events for <code className="tt-inline-code">{agentId.trim()}</code>: {data.statsTotal}
            </p>
            <div className="tt-table-wrap">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Rows loaded</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="tt-table-cell--mono">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="tt-dash__section" style={{ marginTop: '1rem' }}>
            <h2 className="tt-dash__h2">Recent records for this credential</h2>
            <div className="tt-table-wrap">
              <table className="tt-table">
                <thead>
                  <tr>
                    <th>Domain</th>
                    <th>Time</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {data.processes.slice(0, 5).map((e) => (
                    <tr key={`p-${e.id}`}>
                      <td>process</td>
                      <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                      <td>{e.event_type}: {e.process_name ?? '—'}</td>
                    </tr>
                  ))}
                  {data.systems.slice(0, 5).map((e) => (
                    <tr key={`s-${e.id}`}>
                      <td>system</td>
                      <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                      <td>CPU {e.cpu_usage ?? '—'}% · Mem {e.memory_usage ?? '—'}%</td>
                    </tr>
                  ))}
                  {data.network.slice(0, 5).map((e) => (
                    <tr key={`n-${e.id}`}>
                      <td>network</td>
                      <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                      <td>{e.process_name ?? '—'} → {e.remote_port ?? '—'} ({e.status ?? '—'})</td>
                    </tr>
                  ))}
                  {data.emails.slice(0, 5).map((e) => (
                    <tr key={`e-${e.id}`}>
                      <td>email</td>
                      <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                      <td>{e.sender ?? '—'} — {e.subject ?? '—'}</td>
                    </tr>
                  ))}
                  {data.files.slice(0, 5).map((e) => (
                    <tr key={`f-${e.id}`}>
                      <td>file</td>
                      <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                      <td>{e.event_type}: {e.file_path ?? '—'}</td>
                    </tr>
                  ))}
                  {data.usb.slice(0, 5).map((e) => (
                    <tr key={`u-${e.id}`}>
                      <td>usb</td>
                      <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                      <td>{e.event_type}: {e.mountpoint ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
