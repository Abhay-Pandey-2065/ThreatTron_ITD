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
  session_id?: string | null
  event_type: string
  timestamp: string
  file_path: string | null
  action: string | null
  extra_data: Record<string, unknown> | null
}

export interface ProcessEventRow {
  id: number
  agent_id: string
  session_id?: string | null
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
  session_id?: string | null
  timestamp: string
  cpu_usage: number | null
  memory_usage: number | null
}

export interface USBEventRow {
  id: number
  agent_id: string
  session_id?: string | null
  event_type: string
  timestamp: string
  mountpoint: string | null
}

export interface NetworkEventRow {
  id: number
  agent_id: string
  session_id?: string | null
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
  type: 'file' | 'process' | 'system' | 'usb' | 'network'
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

export type AlertStatus = 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive'
export type InvestigationStatus = 'open' | 'in_progress' | 'resolved'

export interface SecurityAlert {
  id: number
  agent_id: string
  title: string
  risk_score: number
  severity: string
  evidence_refs: { type: string; id: number }[]
  status: AlertStatus
  false_positive: boolean
  feedback: string | null
  created_at: string
  updated_at: string
  last_seen_at: string
}

export interface SecurityEvidence {
  type: string
  id: number
}

export interface InvestigationRecord {
  id: number
  alert_id: number
  title: string
  status: InvestigationStatus
  alert?: SecurityAlert | null
  created_at: string
  updated_at: string
  notes: { id: number; body: string; created_at: string }[]
  evidence_refs: SecurityEvidence[]
  timeline: WorkflowAuditRecord[]
}

export interface WorkflowAuditRecord {
  id: number
  entity_type: string
  entity_id: number
  actor_user_id: number | null
  actor_email: string | null
  action: string
  details: Record<string, unknown> | null
  is_simulation?: true
  created_at: string
}

export interface SandboxScenario {
  id: number
  agent_id: string
  title: string
  risk_score: number
  is_threat: boolean
  rules_triggered: string[]
  evidence_refs: SecurityEvidence[]
  timeline: WorkflowAuditRecord[]
  is_simulation: true
  created_at: string
  alert: SandboxAlert | null
}

export interface SandboxAlert {
  id: number
  case_id: number
  title: string
  severity: string
  risk_score: number
  status: AlertStatus
  false_positive: boolean
  feedback: string | null
  is_simulation: true
  created_at: string
  updated_at: string
}

export interface SandboxInvestigation {
  id: number
  alert_id: number
  title: string
  status: InvestigationStatus
  is_simulation: true
  created_at: string
  updated_at: string
  alert: SandboxAlert | null
  evidence_refs: SecurityEvidence[]
  notes: { id: number; body: string; created_at: string; is_simulation: true }[]
  timeline: WorkflowAuditRecord[]
}

export async function fetchSecurityAlerts(): Promise<SecurityAlert[]> {
  const data = await fetchJson<{ alerts?: SecurityAlert[] }>('/api/security/alerts')
  return data.alerts ?? []
}

export async function updateSecurityAlertStatus(alertId: number, status: AlertStatus): Promise<SecurityAlert> {
  return await fetchJson<SecurityAlert>(`/api/security/alerts/${alertId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
}

export async function submitSecurityFeedback(alertId: number, verdict: 'false_positive' | 'confirmed', note?: string): Promise<SecurityAlert> {
  return await fetchJson<SecurityAlert>(`/api/security/alerts/${alertId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdict, note }),
  })
}

export async function fetchInvestigations(): Promise<InvestigationRecord[]> {
  const data = await fetchJson<{ investigations?: InvestigationRecord[] }>('/api/security/investigations')
  return data.investigations ?? []
}

export async function fetchInvestigation(id: string): Promise<InvestigationRecord> {
  return await fetchJson<InvestigationRecord>(`/api/security/investigations/${encodeURIComponent(id)}`)
}

export async function createInvestigation(alertId: number): Promise<InvestigationRecord> {
  return await fetchJson<InvestigationRecord>('/api/security/investigations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_id: alertId }),
  })
}

export async function updateInvestigation(id: string, update: { status: InvestigationStatus; note?: string }): Promise<InvestigationRecord> {
  return await fetchJson<InvestigationRecord>(`/api/security/investigations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  })
}

export async function addInvestigationNote(id: number, body: string): Promise<{ id: number; investigation_id: number; body: string; created_at: string }> {
  return await fetchJson(`/api/security/investigations/${id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
}

export async function fetchWorkflowAudit(entityType: string, entityId: number): Promise<WorkflowAuditRecord[]> {
  const query = new URLSearchParams({ entity_type: entityType, entity_id: String(entityId) })
  const data = await fetchJson<{ events?: WorkflowAuditRecord[] }>(`/api/security/audit?${query}`)
  return data.events ?? []
}

export async function fetchSandboxScenarios(): Promise<SandboxScenario[]> {
  const data = await fetchJson<{ cases?: SandboxScenario[] }>('/api/security/sandbox/cases')
  return data.cases ?? []
}

export async function createSandboxScenario(payload: { scenario: string; risk_score: number; rules_triggered: string[] }): Promise<SandboxScenario> {
  return await fetchJson<SandboxScenario>('/api/security/sandbox/cases', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function updateSandboxInvestigation(id: number, status: InvestigationStatus, note?: string): Promise<SandboxInvestigation> {
  return await fetchJson<SandboxInvestigation>(`/api/security/sandbox/investigations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  })
}

export async function updateSandboxAlert(id: number, status: AlertStatus, note?: string): Promise<SandboxAlert> {
  return await fetchJson<SandboxAlert>(`/api/security/sandbox/alerts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, note }),
  })
}

export async function submitSandboxFeedback(id: number, verdict: 'false_positive' | 'confirmed', note?: string): Promise<SandboxAlert> {
  return await fetchJson<SandboxAlert>(`/api/security/sandbox/alerts/${id}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ verdict, note }),
  })
}

export async function createSandboxInvestigation(alertId: number): Promise<SandboxInvestigation> {
  return await fetchJson<SandboxInvestigation>('/api/security/sandbox/investigations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ alert_id: alertId }),
  })
}

export async function addSandboxInvestigationNote(id: number, body: string): Promise<SandboxInvestigation> {
  return await fetchJson<SandboxInvestigation>(`/api/security/sandbox/investigations/${id}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  })
}

export async function fetchSandboxInvestigations(): Promise<SandboxInvestigation[]> {
  const data = await fetchJson<{ investigations?: SandboxInvestigation[] }>('/api/security/sandbox/investigations')
  return data.investigations ?? []
}

export async function fetchSandboxAudit(): Promise<WorkflowAuditRecord[]> {
  const data = await fetchJson<{ events?: WorkflowAuditRecord[] }>('/api/security/sandbox/audit')
  return data.events ?? []
}
