import { Link } from 'react-router-dom'
import { Drawer } from '../../shared/Drawer'
import type { MlInsight } from '../../lib/api'
import { useShellFilters } from '../../layout/useShellFilters'

interface MlInsightDrawerProps {
  insight: MlInsight | null
  open: boolean
  onClose: () => void
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

export function MlInsightDrawer({ insight, open, onClose }: MlInsightDrawerProps) {
  const { buildPath } = useShellFilters()

  if (!insight) return null

  return (
    <Drawer open={open} onClose={onClose} title={`Insight: ${insight.type}`}>
      <dl className="tt-ml-meta">
        <div>
          <dt>Severity</dt>
          <dd>
            <span className={`tt-severity ${severityClass(insight.severity)}`}>{insight.severity}</span>
          </dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{insight.type}</dd>
        </div>
        <div>
          <dt>Entity</dt>
          <dd>{insight.entity}</dd>
        </div>
        {insight.entity_type && (
          <div>
            <dt>Entity type</dt>
            <dd>{insight.entity_type}</dd>
          </div>
        )}
        {insight.score != null && (
          <div>
            <dt>Score</dt>
            <dd>{insight.score.toFixed(2)}</dd>
          </div>
        )}
        <div>
          <dt>Time</dt>
          <dd>{formatTime(insight.timestamp)}</dd>
        </div>
        {insight.time_window && (
          <div>
            <dt>Time window</dt>
            <dd>{insight.time_window}</dd>
          </div>
        )}
        {insight.reason && (
          <div>
            <dt>Reason</dt>
            <dd>{insight.reason}</dd>
          </div>
        )}
      </dl>

      {insight.feature_contribution && Object.keys(insight.feature_contribution).length > 0 && (
        <>
          <h3 className="tt-drawer__sub">Feature contribution</h3>
          <pre className="tt-extra-data">
            {JSON.stringify(insight.feature_contribution, null, 2)}
          </pre>
        </>
      )}

      {insight.linked_events && insight.linked_events.length > 0 && (
        <>
          <h3 className="tt-drawer__sub">Linked raw events</h3>
          <ul className="tt-ml-linked">
            {insight.linked_events.map((ev, i) => (
              <li key={i}>
                <Link
                  className="tt-link"
                  to={buildPath(ev.type === 'file' ? '/files' : ev.type === 'process' ? '/processes' : '/overview')}
                >
                  {ev.type} #{ev.id}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Drawer>
  )
}
