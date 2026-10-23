import type { AlertStatus, InvestigationStatus } from '../lib/api'

/** Plain-language names for backend status values, used across the console. */
export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  investigating: 'Investigating',
  resolved: 'Resolved',
  false_positive: 'False positive',
}

export const INVESTIGATION_STATUS_LABELS: Record<InvestigationStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  resolved: 'Resolved',
}
