import type { MlInsight } from '../../lib/api'

interface MlInsightTableProps {
  insights: MlInsight[]
  onRowClick: (insight: MlInsight) => void
}

function formatTime(ts: string): string {
  try {
    const d = new Date(ts)
    return isNaN(d.getTime()) ? ts : d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return ts
  }
}

function severityClass(severity: string): string {
  const s = severity.toLowerCase()
  if (s === 'critical') return 'tt-severity--critical'
  if (s === 'warn') return 'tt-severity--warn'
  return 'tt-severity--info'
}

export function MlInsightTable({ insights, onRowClick }: MlInsightTableProps) {
  return (
    <div className="tt-table-wrap">
      <table className="tt-table">
        <thead>
          <tr>
            <th>Severity</th>
            <th>Type</th>
            <th>Entity</th>
            <th>Score</th>
            <th>Time</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {insights.map((insight) => (
            <tr
              key={insight.id}
              className="tt-table-row--clickable"
              onClick={() => onRowClick(insight)}
            >
              <td>
                <span className={`tt-severity ${severityClass(insight.severity)}`}>
                  {insight.severity}
                </span>
              </td>
              <td>{insight.type}</td>
              <td className="tt-table-cell--mono" title={insight.entity}>
                {insight.entity.length > 40 ? `${insight.entity.slice(0, 40)}…` : insight.entity}
              </td>
              <td className="tt-table-cell--mono">
                {insight.score != null ? insight.score.toFixed(2) : '—'}
              </td>
              <td className="tt-table-cell--mono tt-table-cell--nowrap">
                {formatTime(insight.timestamp)}
              </td>
              <td className="tt-table-cell--muted" title={insight.reason ?? ''}>
                {insight.reason
                  ? insight.reason.length > 50
                    ? `${insight.reason.slice(0, 50)}…`
                    : insight.reason
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
