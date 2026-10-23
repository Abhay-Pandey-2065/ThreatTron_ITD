import { useEffect, useState } from 'react'
import { fetchLiveRisk, type RiskResponse } from '../../lib/api'

interface MLLiveRiskGaugeProps {
  agentId?: string
}

const RULE_LABELS: Record<string, string> = {
  USB_FILE_EXFIL: 'USB and file exfiltration',
  SUSPICIOUS_WEB_STAGING: 'Suspicious web browsing and file staging',
  EMAIL_EXFILTRATION: 'Email data leakage',
  FULL_KILL_CHAIN: 'Full attack chain',
  SUSPICIOUS_FILE_TYPES: 'Suspicious file types (.exe, .zip)',
  AFTER_HOURS_EXFIL: 'After-hours data exfiltration',
  MASS_RECIPIENT_SPRAY: 'Email sent to many outside recipients',
}

const MODELS: { key: string; label: string; tooltip?: string }[] = [
  { key: 'lightgbm_confidence', label: 'LightGBM' },
  { key: 'rf_confidence', label: 'Random forest' },
  { key: 'lr_confidence', label: 'Logistic regression' },
  {
    key: 'anomaly_confidence',
    label: 'Isolation forest',
    tooltip: 'Flags behaviour that departs from the baseline, even when no named rule fired.',
  },
]

const WINDOWS = [15, 30, 60]

type Level = 'low' | 'medium' | 'high'

function levelOf(pct: number): Level {
  if (pct < 30) return 'low'
  if (pct < 65) return 'medium'
  return 'high'
}

const LEVEL_LABEL: Record<Level, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk',
}

function trendLabel(trend: string | undefined): string {
  if (trend === '↑') return 'Rising'
  if (trend === '↓') return 'Falling'
  return 'Stable'
}

export function MLLiveRiskGauge({ agentId = 'Global' }: MLLiveRiskGaugeProps) {
  const [riskData, setRiskData] = useState<RiskResponse | null>(null)
  const [offline, setOffline] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [windowMinutes, setWindowMinutes] = useState(30)

  useEffect(() => {
    let cancelled = false
    const fetchRisk = async () => {
      try {
        const data = await fetchLiveRisk(agentId, windowMinutes)
        if (cancelled) return
        setRiskData(data)
        setOffline(false)
        setLastUpdate(new Date())
      } catch {
        if (!cancelled) setOffline(true)
      }
    }
    void fetchRisk()
    const id = setInterval(fetchRisk, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [agentId, windowMinutes])

  const score = riskData?.risk_score ?? 0
  const pct = Math.min(100, Math.max(0, score * 100))
  const level = levelOf(pct)
  const lastAlert = riskData?.last_alert
    ? new Date(riskData.last_alert).toLocaleTimeString(undefined, { timeStyle: 'short' })
    : null
  const rules = riskData?.rules_triggered ?? []

  return (
    <div className={`tt-live ${offline ? 'tt-live--offline' : ''}`}>
      <div className="tt-live__toolbar">
        <p className="tt-live__status">
          {offline
            ? 'Live updates are paused because the service is unreachable. They resume automatically.'
            : lastUpdate
              ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Waiting for the first update…'}
        </p>
        <div className="tt-segmented" role="group" aria-label="Look-back window">
          {WINDOWS.map((minutes) => (
            <button
              key={minutes}
              type="button"
              className={`tt-segmented__item ${windowMinutes === minutes ? 'tt-segmented__item--active' : ''}`}
              aria-pressed={windowMinutes === minutes}
              onClick={() => setWindowMinutes(minutes)}
            >
              {minutes} min
            </button>
          ))}
        </div>
      </div>

      <div className="tt-live__body">
        <div className="tt-live__summary">
          <p className="tt-live__score">
            <span className={`tt-level tt-level--${level}`}>{score.toFixed(3)}</span>
          </p>
          <p className="tt-live__caption">Risk score</p>
          <div className="tt-meter" aria-hidden>
            <div className={`tt-meter__fill tt-meter__fill--${level}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="tt-live__level">
            <span className={`tt-level tt-level--${level}`}>{offline ? 'Unavailable' : LEVEL_LABEL[level]}</span>
            {!offline ? <span className="tt-dash__muted"> · {trendLabel(riskData?.trend)}</span> : null}
          </p>
          {riskData?.event_count !== undefined && !offline ? (
            <p className="tt-dash__muted">Based on {riskData.event_count.toLocaleString()} events</p>
          ) : null}
        </div>

        <div className="tt-live__details">
          <dl className="tt-facts">
            <div>
              <dt>Agent</dt>
              <dd className="tt-mono">{riskData?.user_id || agentId}</dd>
            </div>
            <div>
              <dt>Hostname</dt>
              <dd>{riskData?.hostname || '—'}</dd>
            </div>
            <div>
              <dt>ML score</dt>
              <dd className="tt-mono">{riskData?.ml_score?.toFixed(3) ?? '—'}</dd>
            </div>
            <div>
              <dt>Rule score</dt>
              <dd className="tt-mono">{riskData?.rule_score?.toFixed(3) ?? '—'}</dd>
            </div>
            <div>
              <dt>Last alert</dt>
              <dd>{lastAlert ?? 'None in this session'}</dd>
            </div>
          </dl>

          {rules.length > 0 ? (
            <section className="tt-live__section">
              <h3 className="tt-live__heading">Patterns detected</h3>
              <ul className="tt-live__patterns">
                {rules.map((rule) => (
                  <li key={rule}>{RULE_LABELS[rule] ?? rule}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {riskData?.sub_scores ? (
            <section className="tt-live__section">
              <h3 className="tt-live__heading">Model breakdown</h3>
              {MODELS.map((model) => {
                const value = (riskData.sub_scores as Record<string, number>)[model.key] ?? 0
                return (
                  <div className="tt-bar" key={model.key}>
                    <div className="tt-bar__head">
                      <span title={model.tooltip}>{model.label}</span>
                      <span className="tt-mono">{(value * 100).toFixed(1)}%</span>
                    </div>
                    <div className="tt-bar__track">
                      <div className="tt-bar__fill" style={{ width: `${value * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </section>
          ) : null}

          {offline ? (
            <p className="tt-dash__muted">
              Start the backend service to see live risk for this agent.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
