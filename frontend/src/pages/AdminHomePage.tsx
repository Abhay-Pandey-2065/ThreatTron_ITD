import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  fetchFileEvents,
  fetchNetworkEvents,
  fetchOverviewStats,
  fetchProcessEvents,
  fetchSystemEvents,
  fetchUSBEvents,
  type FileEventRow,
  type NetworkEventRow,
  type ProcessEventRow,
  type SystemEventRow,
  type USBEventRow,
} from '../lib/api'
import { ErrorRetry } from '../shared/ErrorRetry'

// Each row also carries the session it was grouped into on this page.
type WithLocalSession<T> = T & { __local_session_id?: string }

type LookupData = {
  statsTotal: number
  files: WithLocalSession<FileEventRow>[]
  processes: WithLocalSession<ProcessEventRow>[]
  systems: WithLocalSession<SystemEventRow>[]
  usb: WithLocalSession<USBEventRow>[]
  network: WithLocalSession<NetworkEventRow>[]
  sessions: string[]
}

/** Gap between events that starts a new inferred session. */
const SESSION_GAP_MS = 30 * 60 * 1000

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

/** Shows an inferred session as "Inferred session 2"; backend session IDs are shown as they are. */
function sessionLabel(session: string): string {
  return session.startsWith('Session ') ? `Inferred session ${session.replace('Session ', '')}` : session
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
      const [stats, files, processes, systems, usb, network] = await Promise.all([
        fetchOverviewStats({ time_range: '7d', agent_id: targetAgentId }),
        fetchFileEvents(q),
        fetchProcessEvents(q),
        fetchSystemEvents(q),
        fetchUSBEvents(q),
        fetchNetworkEvents(q),
      ])

      const total = stats?.total_events ?? 0

      // Flatten every domain into one timeline, then group it into sessions.
      type RowLike = {
        timestamp?: string
        session_id?: unknown
        sessionId?: unknown
        SessionId?: unknown
      }
      type GenericEvent = {
        _domain: keyof LookupData
        _obj: RowLike
        time: number
      }

      const allEvents: GenericEvent[] = []

      const pushEvents = (domain: keyof LookupData, arr: RowLike[]) => {
        arr.forEach((e) => {
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
      pushEvents('usb', usb)
      pushEvents('network', network)

      // Sort chronologically.
      allEvents.sort((a, b) => a.time - b.time)

      const clusteredData = {
        files: [] as WithLocalSession<FileEventRow>[],
        processes: [] as WithLocalSession<ProcessEventRow>[],
        systems: [] as WithLocalSession<SystemEventRow>[],
        usb: [] as WithLocalSession<USBEventRow>[],
        network: [] as WithLocalSession<NetworkEventRow>[],
      }

      let currentSessionId = ''
      let sessionCounter = 0
      let lastTime = 0
      const sessionsSet = new Set<string>()

      allEvents.forEach((evt) => {
        // Use the backend's session ID when it sends one.
        const backendSession = evt._obj.session_id || evt._obj.sessionId || evt._obj.SessionId

        let assignedSession = ''

        if (backendSession) {
          assignedSession = String(backendSession)
        } else {
          // Otherwise infer sessions from gaps between events.
          if (!currentSessionId || evt.time - lastTime > SESSION_GAP_MS) {
            sessionCounter++
            currentSessionId = `Session ${sessionCounter}`
          }
          assignedSession = currentSessionId
          lastTime = evt.time
        }

        sessionsSet.add(assignedSession)
        const row = evt._obj as { __local_session_id?: string }
        row.__local_session_id = assignedSession

        switch (evt._domain) {
          case 'files':
            clusteredData.files.push(evt._obj as WithLocalSession<FileEventRow>)
            break
          case 'processes':
            clusteredData.processes.push(evt._obj as WithLocalSession<ProcessEventRow>)
            break
          case 'systems':
            clusteredData.systems.push(evt._obj as WithLocalSession<SystemEventRow>)
            break
          case 'usb':
            clusteredData.usb.push(evt._obj as WithLocalSession<USBEventRow>)
            break
          case 'network':
            clusteredData.network.push(evt._obj as WithLocalSession<NetworkEventRow>)
            break
          default:
            break
        }
      })

      const sessionsArr = Array.from(sessionsSet).sort((a, b) => {
        // Sort "Session 2" before "Session 10".
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
        usb: clusteredData.usb,
        network: clusteredData.network,
        sessions: sessionsArr,
      })

      // Open the most recent session by default.
      setSelectedSessionId(sessionsArr.length > 0 ? sessionsArr[sessionsArr.length - 1] : null)

      if (total === 0) {
        setError('No records were found for this agent ID in the last 7 days.')
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unable to load activity for this agent ID.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = agentId.trim()
    if (!trimmed) {
      setError('Enter an agent ID.')
      return
    }
    void load(trimmed)
  }

  const activeData = useMemo(() => {
    if (!data || !selectedSessionId) return null

    const matchSession = (s: string | undefined) => s === selectedSessionId

    return {
      files: data.files.filter((e) => matchSession(e.__local_session_id)),
      processes: data.processes.filter((e) => matchSession(e.__local_session_id)),
      systems: data.systems.filter((e) => matchSession(e.__local_session_id)),
      usb: data.usb.filter((e) => matchSession(e.__local_session_id)),
      network: data.network.filter((e) => matchSession(e.__local_session_id)),
    }
  }, [data, selectedSessionId])

  const sessionCount = activeData
    ? activeData.processes.length +
      activeData.files.length +
      activeData.network.length +
      activeData.systems.length +
      activeData.usb.length
    : 0

  return (
    <div className="tt-page">
      <header className="tt-domain-page__header">
        <h1 className="tt-page__title">User activity lookup</h1>
        <p className="tt-domain-page__sub">
          Enter an agent ID to load its activity from the last 7 days, grouped into sessions.
        </p>
      </header>

      <form className="tt-admin-form" onSubmit={onSubmit}>
        <label className="tt-filter tt-admin-form__field">
          <span className="tt-filter__label">Agent ID</span>
          <input
            className="tt-input"
            type="text"
            placeholder="agent-xxxxxxxx"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          />
        </label>
        <button type="submit" className="tt-button tt-button--primary" disabled={!canSearch}>
          {loading ? 'Loading…' : 'Load activity'}
        </button>
      </form>

      {error ? <ErrorRetry message={error} onRetry={() => void load(agentId.trim())} /> : null}

      {data ? (
        <>
          <section className="tt-dash__section tt-admin-section">
            <div className="tt-admin-sessions">
              <label className="tt-filter">
                <span className="tt-filter__label">Session</span>
                <select
                  className="tt-select"
                  value={selectedSessionId ?? ''}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  disabled={data.sessions.length === 0}
                >
                  {data.sessions.map((s) => (
                    <option key={s} value={s}>
                      {sessionLabel(s)}
                    </option>
                  ))}
                </select>
              </label>
              {data.sessions.length > 0 && selectedSessionId ? (
                <p className="tt-dash__muted">
                  {sessionCount} {sessionCount === 1 ? 'event' : 'events'} in {sessionLabel(selectedSessionId)}.
                </p>
              ) : (
                <p className="tt-dash__muted">No sessions found for this agent ID.</p>
              )}
            </div>
          </section>

          {activeData && data.sessions.length > 0 ? (
            <div className="tt-admin-stack">
              {activeData.processes.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">Processes ({activeData.processes.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event</th>
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
                          <th>Event</th>
                          <th>Path</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.files.map((e) => (
                          <tr key={`f-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.event_type}</td>
                            <td className="tt-mono">{e.file_path ?? '—'}</td>
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
                          <th>Remote port</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.network.map((e) => (
                          <tr key={`n-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.process_name ?? '—'}</td>
                            <td className="tt-mono">{e.remote_port ?? '—'}</td>
                            <td>{e.status ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.systems.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">System ({activeData.systems.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th className="tt-num">CPU</th>
                          <th className="tt-num">Memory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.systems.map((e) => (
                          <tr key={`s-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td className="tt-num">{e.cpu_usage ?? '—'}%</td>
                            <td className="tt-num">{e.memory_usage ?? '—'}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {activeData.usb.length > 0 && (
                <section className="tt-dash__section">
                  <h2 className="tt-dash__h2">USB ({activeData.usb.length})</h2>
                  <div className="tt-table-wrap">
                    <table className="tt-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Event</th>
                          <th>Mount point</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeData.usb.map((e) => (
                          <tr key={`u-${e.id}`}>
                            <td className="tt-table-cell--mono tt-table-cell--nowrap">{formatTime(e.timestamp)}</td>
                            <td>{e.event_type}</td>
                            <td className="tt-mono">{e.mountpoint ?? '—'}</td>
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
                !activeData.systems.length &&
                !activeData.usb.length && (
                  <p className="tt-dash__muted">No activity was recorded in this session.</p>
                )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
