/**
 * API client for telemetry and domain endpoints.
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
  parent_name: string | null
  parent_pid: number | null
  suspicious_spawn: boolean | null
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
  has_links: boolean | null
}

export interface USBEventRow {
  id: number
  agent_id: string
  event_type: string
  timestamp: string
  mountpoint: string | null
}

export interface NetworkEventRow {
  id: number
  agent_id: string
  timestamp: string
  local_ip_hash: string | null
  local_port: number | null
  remote_ip_hash: string | null
  remote_port: number | null
  status: string | null
  pid: number | null
  process_name: string | null
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

export async function fetchNetworkEvents(q: EventsQuery): Promise<NetworkEventRow[]> {
  try {
    const data = await fetchJson<{ items?: NetworkEventRow[]; events?: NetworkEventRow[] }>(
      `/api/events/network${buildQuery(q)}`,
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

export async function fetchOverviewStats(q: EventsQuery): Promise<OverviewStats | null> {
  try {
    return await fetchJson<OverviewStats | null>(`/api/overview/stats${buildQuery(q)}`)
  } catch {
    return null
  }
}

export interface RecentEvent {
  type: 'file' | 'process' | 'system' | 'email' | 'usb' | 'network'
  id: number
  agent_id: string
  timestamp: string
  summary: string
  ml_flagged?: boolean
}

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

export async function fetchMlSummary(q: EventsQuery): Promise<MlSummary | null> {
  try {
    return await fetchJson<MlSummary | null>(`/ml/summary${buildQuery(q)}`)
  } catch {
    return null
  }
}

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

/* —— Auth API —— */

export async function signupUser(email: string, password: string, role: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetchJson<{ message: string }>(`/api/auth/signup`, {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    })
    return { ok: true, message: res.message }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Signup failed' }
  }
}

export async function loginUser(email: string, password: string, portal: string): Promise<{ ok: boolean; message?: string; data?: any }> {
  try {
    const data = await fetchJson<any>(`/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password, portal }),
    })
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, message: err.message || 'Login failed' }
  }
}

export interface RiskResponse {
  user_id?: string
  risk_score: number
  is_threat: boolean
  ml_score: number
  rule_score: number
  rules_triggered: string[]
  sub_scores?: {
    lightgbm_confidence: number
    rf_confidence?: number
    lr_confidence?: number
    anomaly_confidence: number
  }
  hostname: string | null
  event_count: number
  window_minutes?: number
  trend: string
  last_alert: string | null
  status?: string
  message?: string
}

export async function fetchLiveRisk(agentId: string, window: number): Promise<RiskResponse> {
  return await fetchJson<RiskResponse>(`/api/risk?agent_id=${agentId}&window=${window}`)
}
