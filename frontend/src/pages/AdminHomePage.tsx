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

// Extend API rows locally to hold our computed temporal session grouping
type WithLocalSession<T> = T & { __local_session_id?: string }

type LookupData = {
  statsTotal: number
  files: WithLocalSession<FileEventRow>[]
  processes: WithLocalSession<ProcessEventRow>[]
  systems: WithLocalSession<SystemEventRow>[]
  emails: WithLocalSession<EmailEventRow>[]
  usb: WithLocalSession<USBEventRow>[]
  network: WithLocalSession<NetworkEventRow>[]
  sessions: string[]
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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const canSearch = agentId.trim().length > 0 && !loading

  const load = async (targetAgentId: string) => {
    setLoading(true)
    setError(null)
    try {
      const q = { time_range: '7d', agent_id: targetAgentId, limit: 500 }
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

      // We will flatten, sort, and cluster events temporally.
      // E.g. A gap > 30 mins denotes a new inferred session!
      type GenericEvent = {
        _domain: keyof LookupData
        _obj: any
        time: number
      }

      const allEvents: GenericEvent[] = []
      
      const pushEvents = (domain: keyof LookupData, arr: any[]) => {
        arr.forEach(e => {
           let t = 0
           if (e.timestamp) {
             const d = new Date(e.timestamp)
             if (!isNaN(d.getTime())) t = d.getTime()
           }
           allEvents.push({ _domain: domain, _obj: e, time: t })
        })
      }

      pushEvents('files', files)
      pushEvents('processes', processes)
      pushEvents('systems', systems)
      pushEvents('emails', emails)
      pushEvents('usb', usb)
      pushEvents('network', network)

      // Sort chronological
      allEvents.sort((a, b) => a.time - b.time)

      const clusteredData = {
        files: [] as WithLocalSession<FileEventRow>[],
        processes: [] as WithLocalSession<ProcessEventRow>[],
        systems: [] as WithLocalSession<SystemEventRow>[],
        emails: [] as WithLocalSession<EmailEventRow>[],
        usb: [] as WithLocalSession<USBEventRow>[],
        network: [] as WithLocalSession<NetworkEventRow>[]
      }

      const GAP_MS = 30 * 60 * 1000 // 30 minutes threshold
      let currentSessionId = ''
      let sessionCounter = 0
      let lastTime = 0
      const sessionsSet = new Set<string>()

      allEvents.forEach(evt => {
        // If the backend magically sends some explicit session property, use it.
        const backendSession = evt._obj.session_id || evt._obj.sessionId || evt._obj.SessionId
        
        let assignedSession = ''

        if (backendSession) {
          assignedSession = String(backendSession)
        } else {
          // Temporally cluster if there's no backend session_id supplied in JSON
          if (!currentSessionId || (evt.time - lastTime > GAP_MS)) {
             sessionCounter++
             currentSessionId = `Session ${sessionCounter}`
          }
          assignedSession = currentSessionId
          lastTime = evt.time
        }

        sessionsSet.add(assignedSession)
        evt._obj.__local_session_id = assignedSession
        
        const d = clusteredData[evt._domain as keyof typeof clusteredData]
        if (d) {
          (d as any[]).push(evt._obj)
        }
      })

      const sessionsArr = Array.from(sessionsSet).sort((a, b) => {
        // Check if both are generated "Session X" formatting to naturally sort "Session 2" before "Session 10"
        if (a.startsWith('Session ') && b.startsWith('Session ')) {
           const numA = parseInt(a.replace('Session ', ''))
           const numB = parseInt(b.replace('Session ', ''))
           if (!isNaN(numA) && !isNaN(numB)) return numA - numB
        }
        return a.localeCompare(b)
      })

      setData({
        statsTotal: total,
        files: clusteredData.files,
        processes: clusteredData.processes,
        systems: clusteredData.systems,
        emails: clusteredData.emails,
        usb: clusteredData.usb,
        network: clusteredData.network,
        sessions: sessionsArr
      })

      if (sessionsArr.length > 0) {
        setSelectedSessionId(sessionsArr[sessionsArr.length - 1]) // Default to most recent session
      } else {
        setSelectedSessionId(null)
      }

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

  const activeData = useMemo(() => {
    if (!data || !selectedSessionId) return null

    // Filter using the computed dynamic property!
    const matchSession = (s: string | undefined) => s === selectedSessionId

    return {
      files: data.files.filter(e => matchSession(e.__local_session_id)),
      processes: data.processes.filter(e => matchSession(e.__local_session_id)),
      systems: data.systems.filter(e => matchSession(e.__local_session_id)),
      emails: data.emails.filter(e => matchSession(e.__local_session_id)),
      usb: data.usb.filter(e => matchSession(e.__local_session_id)),
      network: data.network.filter(e => matchSession(e.__local_session_id)),
    }
  }, [data, selectedSessionId])

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
            <h2 className="tt-dash__h2">Discovered Sessions</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {data.sessions.map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSessionId(s)}
                  className={`tt-button ${selectedSessionId === s ? 'tt-button--primary' : 'tt-button--ghost'}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {data.sessions.length === 0 && (
              <p className="tt-dash__muted">No sessions found.</p>
            )}
            
            {data.sessions.length > 0 && selectedSessionId && (
              <p className="tt-dash__muted" style={{ marginBottom: '1rem' }}>
                Showing domain records grouped under <strong style={{color:"white"}}>{selectedSessionId}</strong>.
              </p>
            )}
          </section>

          {activeData && data.sessions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {activeData.processes.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">Processes ({activeData.processes.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event Type</th>
                          <th>Process</th>
                          <th>Parent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.processes.map((e) => (
                          <tr key={`p-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.event_type}</td>
                            <td>{e.process_name ?? '—'}</td>
                            <td>{e.parent_name ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.files.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">Files ({activeData.files.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event Type</th>
                          <th>Path</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.files.map((e) => (
                          <tr key={`f-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.event_type}</td>
                            <td>{e.file_path ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.network.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">Network ({activeData.network.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Process</th>
                          <th>Remote Port</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.network.map((e) => (
                          <tr key={`n-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.process_name ?? '—'}</td>
                            <td>{e.remote_port ?? '—'}</td>
                            <td>{e.status ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.emails.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">Emails ({activeData.emails.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Sender</th>
                          <th>Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.emails.map((e) => (
                          <tr key={`e-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.sender ?? '—'}</td>
                            <td>{e.subject ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.systems.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">System Records ({activeData.systems.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>CPU Usage</th>
                          <th>Memory Usage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.systems.map((e) => (
                          <tr key={`s-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.cpu_usage ?? '—'}%</td>
                            <td>{e.memory_usage ?? '—'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.usb.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">USB Activities ({activeData.usb.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event Type</th>
                          <th>Mountpoint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.usb.map((e) => (
                          <tr key={`u-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.event_type}</td>
                            <td>{e.mountpoint ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {!activeData.processes.length &&
               !activeData.files.length &&
               !activeData.network.length &&
               !activeData.emails.length &&
               !activeData.systems.length &&
               !activeData.usb.length && (
                 <p className="tt-dash__muted">No records matched for this session.</p>
               )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
