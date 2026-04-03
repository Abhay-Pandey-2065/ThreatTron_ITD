/**
 * API client for telemetry and domain endpoints.
 * Backend read APIs (GET) are not yet implemented; calls will 404 and UI shows empty/loading states.
 */
import { getApiBaseUrl, authHeaders } from './apiToken'

export type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl()
  const url = base ? `${base.replace(/\/$/, '')}${path}` : path
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...init?.headers },
  })
  if (!res.ok) {
    throw new Error(res.status === 404 ? 'Not found' : `HTTP ${res.status}`)
  }
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    throw new Error('API not available')
  }
  const text = await res.text()
  try {
    return text ? (JSON.parse(text) as T) : ({} as T)
  } catch {
    throw new Error('API not available')
  }
}

export interface FileEventRow {
  id: number
  agent_id: string
  event_type: string
  timestamp: string
  file_path: string | null
  action: string | null
  extra_data: Record<string, unknown> | null
}

export interface ProcessEventRow {
  id: number
  agent_id: string
  event_type: string
  timestamp: string
  process_name: string | null
  exe_path: string | null
}

export interface SystemEventRow {
  id: number
  agent_id: string
  timestamp: string
  cpu_usage: number | null
  memory_usage: number | null
}

export interface EmailEventRow {
  id: number
  agent_id: string
  timestamp: string
  sender: string | null
  subject: string | null
  snippet_length: number | null
  has_links: string | null
}

export interface USBEventRow {
  id: number
  agent_id: string
  event_type: string
  timestamp: string
  mountpoint: string | null
}

export interface EventsQuery {
  time_range?: string
  agent_id?: string
  limit?: number
  offset?: number
}

function buildQuery(params: EventsQuery): string {
  const sp = new URLSearchParams()
  if (params.time_range) sp.set('time_range', params.time_range)
  if (params.agent_id) sp.set('agent_id', params.agent_id)
  if (params.limit != null) sp.set('limit', String(params.limit))
  if (params.offset != null) sp.set('offset', String(params.offset))
  const q = sp.toString()
  return q ? `?${q}` : ''
}

/** GET /api/events/files — returns [] when API unavailable (HTML/404 response) */
export async function fetchFileEvents(q: EventsQuery): Promise<FileEventRow[]> {
  try {
    const data = await fetchJson<{ items?: FileEventRow[]; events?: FileEventRow[] }>(
      `/api/events/files${buildQuery(q)}`,
    )
    return data.items ?? data.events ?? []
  } catch {
    return []
  }
}

/** GET /api/events/processes */
export async function fetchProcessEvents(q: EventsQuery): Promise<ProcessEventRow[]> {
  try {
    const data = await fetchJson<{ items?: ProcessEventRow[]; events?: ProcessEventRow[] }>(
      `/api/events/processes${buildQuery(q)}`,
    )
    return data.items ?? data.events ?? []
  } catch {
    return []
  }
}

/** GET /api/events/system */
export async function fetchSystemEvents(q: EventsQuery): Promise<SystemEventRow[]> {
  try {
    const data = await fetchJson<{ items?: SystemEventRow[]; events?: SystemEventRow[] }>(
      `/api/events/system${buildQuery(q)}`,
    )
    return data.items ?? data.events ?? []
  } catch {
    return []
  }
}

/** GET /api/events/emails */
export async function fetchEmailEvents(q: EventsQuery): Promise<EmailEventRow[]> {
  try {
    const data = await fetchJson<{ items?: EmailEventRow[]; events?: EmailEventRow[] }>(
      `/api/events/emails${buildQuery(q)}`,
    )
    return data.items ?? data.events ?? []
  } catch {
    return []
  }
}

/** GET /api/events/usb */
export async function fetchUSBEvents(q: EventsQuery): Promise<USBEventRow[]> {
  try {
    const data = await fetchJson<{ items?: USBEventRow[]; events?: USBEventRow[] }>(
      `/api/events/usb${buildQuery(q)}`,
    )
    return data.items ?? data.events ?? []
  } catch {
    return []
  }
}

export interface OverviewStats {
  total_events?: number
  by_type?: Record<string, number>
  active_agents?: number
}

/** GET /api/overview/stats — returns null when API unavailable */
export async function fetchOverviewStats(_q: EventsQuery): Promise<OverviewStats | null> {
  try {
    return await fetchJson<OverviewStats | null>('/api/overview/stats')
  } catch {
    return null
  }
}

export interface RecentEvent {
  type: 'file' | 'process' | 'system' | 'email' | 'usb'
  id: number
  agent_id: string
  timestamp: string
  summary: string
  ml_flagged?: boolean
}

/** GET /api/overview/recent — returns [] when API unavailable */
export async function fetchRecentEvents(q: EventsQuery): Promise<RecentEvent[]> {
  try {
    const data = await fetchJson<{ items?: RecentEvent[]; events?: RecentEvent[] }>(
      `/api/overview/recent${buildQuery(q)}`,
    )
    return data.items ?? data.events ?? []
  } catch {
    return []
  }
}

/* —— ML / Insights API —— */

export type MlSeverity = 'info' | 'warn' | 'critical'

export interface MlInsight {
  id: string
  severity: MlSeverity
  type: string
  entity: string
  entity_type?: string
  score?: number
  reason?: string
  timestamp: string
  time_window?: string
  feature_contribution?: Record<string, number>
  linked_events?: { type: string; id: number; filters?: Record<string, string> }[]
}

export interface MlSummary {
  model_name?: string
  model_version?: string
  last_inference?: string
  data_window?: string
  open_alerts?: number
  high_severity_24h?: number
  highest_risk_score?: number
}

export interface MlInsightsResponse {
  insights: MlInsight[]
  meta?: { total?: number }
}

/** GET /ml/summary — returns null when API unavailable */
export async function fetchMlSummary(q: EventsQuery): Promise<MlSummary | null> {
  try {
    return await fetchJson<MlSummary | null>(`/ml/summary${buildQuery(q)}`)
  } catch {
    return null
  }
}

/** GET /ml/insights — returns [] when API unavailable */
export async function fetchMlInsights(q: EventsQuery): Promise<MlInsight[]> {
  try {
    const data = await fetchJson<MlInsightsResponse | MlInsight[]>(
      `/ml/insights${buildQuery(q)}`,
    )
    if (Array.isArray(data)) return data
    return data.insights ?? []
  } catch {
    return []
  }
}
