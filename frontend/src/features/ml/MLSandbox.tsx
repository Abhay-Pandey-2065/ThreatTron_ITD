import { useState, type ChangeEvent, type FormEvent } from 'react'
import { getMlApiBaseUrl } from '../../lib/apiToken'

const FIELD_META: Record<string, { label: string; description: string }> = {
  total_logons: { label: 'Total logons', description: 'Total login events' },
  after_hours_logons: { label: 'After-hours logons', description: 'Logins outside 6 AM to 7 PM' },
  weekend_logons: { label: 'Weekend logons', description: 'Logins on Saturday or Sunday' },
  failed_logons: { label: 'Failed logons', description: 'Failed authentication attempts' },
  total_emails: { label: 'Total emails', description: 'Outbound email count' },
  emails_with_attachments: { label: 'Emails with attachments', description: 'Emails carrying files' },
  external_emails: { label: 'External emails', description: 'Sent outside the company domain' },
  total_email_megabytes: { label: 'Email volume (MB)', description: 'Total attachment volume in MB' },
  total_http: { label: 'Web requests', description: 'Total outbound requests' },
  suspicious_http: { label: 'Suspicious web visits', description: 'Visits to file-sharing or hacking sites' },
  total_file: { label: 'File operations', description: 'File read, write and move events' },
  exe_zip_files: { label: 'Executable and archive files', description: 'Executable or archive files' },
  after_hours_file_ops: { label: 'After-hours file operations', description: 'Files touched outside working hours' },
  total_device: { label: 'USB device events', description: 'External drive mount events' },
  num_distinct_pcs: { label: 'Machines used', description: 'Number of machines logged into' },
  unique_http_domains: { label: 'Distinct web domains', description: 'Different sites visited' },
  unique_external_recipients: { label: 'External recipients', description: 'Unique external email addresses' },
}

const PRESETS = {
  Normal: { total_logons: 8, after_hours_logons: 0, weekend_logons: 0, failed_logons: 1, total_emails: 20, emails_with_attachments: 2, external_emails: 1, total_email_megabytes: 0, total_http: 4000, suspicious_http: 1, total_file: 80, exe_zip_files: 0, after_hours_file_ops: 0, total_device: 0, num_distinct_pcs: 1, unique_http_domains: 5, unique_external_recipients: 1 },
  Suspicious: { total_logons: 15, after_hours_logons: 5, weekend_logons: 0, failed_logons: 4, total_emails: 40, emails_with_attachments: 12, external_emails: 18, total_email_megabytes: 25, total_http: 10500, suspicious_http: 18, total_file: 200, exe_zip_files: 4, after_hours_file_ops: 10, total_device: 1, num_distinct_pcs: 2, unique_http_domains: 45, unique_external_recipients: 8 },
  Critical: { total_logons: 60, after_hours_logons: 45, weekend_logons: 0, failed_logons: 12, total_emails: 105, emails_with_attachments: 80, external_emails: 95, total_email_megabytes: 350, total_http: 25000, suspicious_http: 1150, total_file: 45000, exe_zip_files: 100, after_hours_file_ops: 8000, total_device: 5, num_distinct_pcs: 4, unique_http_domains: 120, unique_external_recipients: 40 },
}

const RULE_DESCRIPTIONS: Record<string, string> = {
  USB_FILE_EXFIL: 'Large volume of files moved while a USB drive was in use',
  SUSPICIOUS_WEB_STAGING: 'Suspicious websites visited alongside bulk file activity',
  EMAIL_EXFILTRATION: 'External emails sent alongside significant file activity',
  FULL_KILL_CHAIN: 'Suspicious web use, external email and USB activity together',
  SUSPICIOUS_FILE_TYPES: 'Several executable (.exe) or compressed (.zip) files created or moved',
  AFTER_HOURS_EXFIL: 'Late-night file activity linked with external data transfers',
  MASS_RECIPIENT_SPRAY: 'Email sent to many outside recipients',
}

type PresetKey = keyof typeof PRESETS
type Level = 'low' | 'medium' | 'high'

interface PredictionResult {
  user_id: string
  risk_score: number
  is_threat: boolean
  sub_scores: { lightgbm_confidence: number; rf_confidence?: number; lr_confidence?: number; anomaly_confidence: number }
  status: string
  error?: string
  rules_triggered?: string[]
  ml_score?: number
  rule_score?: number
}

function levelOf(score: number): Level {
  const pct = score * 100
  if (pct < 30) return 'low'
  if (pct < 65) return 'medium'
  return 'high'
}

const LEVEL_TEXT: Record<Level, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk, threat detected',
}

function Bar({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="tt-bar">
      <div className="tt-bar__head">
        <span>{label}</span>
        <span className="tt-mono">{(value * 100).toFixed(1)}%</span>
      </div>
      <div className="tt-bar__track">
        <div className={`tt-bar__fill ${tone ?? ''}`} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
      </div>
    </div>
  )
}

function ResultView({ result }: { result: PredictionResult }) {
  const level = levelOf(result.risk_score)
  return (
    <>
      <div className="tt-sandbox-result__score">
        <span className={`tt-level tt-level--${level}`}>{result.risk_score.toFixed(4)}</span>
        <span className="tt-dash__muted">Composite risk score</span>
        <div className="tt-meter" aria-hidden>
          <div
            className={`tt-meter__fill tt-meter__fill--${level}`}
            style={{ width: `${Math.min(100, Math.max(0, result.risk_score * 100))}%` }}
          />
        </div>
        <p className={`tt-level tt-level--${level}`}>{LEVEL_TEXT[level]}</p>
      </div>

      {result.rules_triggered && result.rules_triggered.length > 0 ? (
        <section className="tt-live__section">
          <h3 className="tt-live__heading">Rules triggered</h3>
          <ul className="tt-live__patterns">
            {result.rules_triggered.map((rule) => (
              <li key={rule} title={RULE_DESCRIPTIONS[rule] ?? rule}>
                {RULE_DESCRIPTIONS[rule] ?? rule}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl className="tt-facts">
        <div>
          <dt>ML score</dt>
          <dd className="tt-mono">{result.ml_score?.toFixed(3) ?? '—'}</dd>
        </div>
        <div>
          <dt>Rule score</dt>
          <dd className="tt-mono">{result.rule_score?.toFixed(3) ?? '—'}</dd>
        </div>
      </dl>

      <section className="tt-live__section">
        <h3 className="tt-live__heading">Model breakdown</h3>
        <Bar label="LightGBM" value={result.sub_scores.lightgbm_confidence} />
        <Bar label="Random forest" value={result.sub_scores.rf_confidence || 0} />
        <Bar label="Logistic regression" value={result.sub_scores.lr_confidence || 0} />
        <Bar label="Isolation forest (anomaly)" value={result.sub_scores.anomaly_confidence} />
      </section>

      <p className="tt-dash__muted">Model service responded: {result.status}</p>
    </>
  )
}

export function MLSandbox() {
  const [formData, setFormData] = useState(PRESETS.Suspicious)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PredictionResult | null>(null)
  const [activePreset, setActivePreset] = useState<PresetKey | null>('Suspicious')

  const handlePreset = (key: PresetKey) => {
    setFormData(PRESETS[key])
    setActivePreset(key)
    setResult(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch(`${getMlApiBaseUrl()}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await response.json()
      if (!response.ok || data.status === 'error' || data.error) {
        setResult({
          user_id: 'Unknown',
          risk_score: 0,
          is_threat: false,
          sub_scores: { lightgbm_confidence: 0, anomaly_confidence: 0 },
          status: 'error',
          error: data.error || data.message || `Request failed (${response.status})`,
        })
      } else {
        setResult(data)
      }
    } catch (err) {
      setResult({
        user_id: 'Unknown',
        risk_score: 0,
        is_threat: false,
        sub_scores: { lightgbm_confidence: 0, anomaly_confidence: 0 },
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not reach the model service.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setFormData((prev) => ({ ...prev, [e.target.name]: value }))
    setActivePreset(null)
  }

  return (
    <div className="tt-sandbox-ml">
      <div className="tt-segmented tt-segmented--wide" role="group" aria-label="Example employee">
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
          <button
            key={key}
            type="button"
            className={`tt-segmented__item ${activePreset === key ? 'tt-segmented__item--active' : ''}`}
            aria-pressed={activePreset === key}
            onClick={() => handlePreset(key)}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="tt-sandbox-ml__grid">
        <section className="tt-soc-panel">
          <h3 className="tt-sandbox-heading">Inputs</h3>
          <form onSubmit={handleSubmit} className="tt-sandbox-ml__form">
            {Object.entries(formData).map(([key, val]) => {
              const meta = FIELD_META[key] ?? { label: key, description: '' }
              const id = `ml-field-${key}`
              return (
                <div key={key} className="tt-sandbox-ml__field">
                  <label htmlFor={id} title={meta.description}>
                    {meta.label}
                  </label>
                  <input
                    id={id}
                    className="tt-input tt-sandbox-ml__input"
                    name={key}
                    type={typeof val === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={handleChange}
                    min={0}
                  />
                </div>
              )
            })}
            <button className="tt-button tt-button--primary tt-sandbox-ml__submit" type="submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="tt-spinner" aria-hidden /> Analyzing…
                </>
              ) : (
                'Run analysis'
              )}
            </button>
          </form>
        </section>

        <section className="tt-soc-panel">
          <h3 className="tt-sandbox-heading">Result</h3>
          {loading ? (
            <div className="tt-sandbox-ml__placeholder">
              <span className="tt-spinner tt-spinner--lg" aria-hidden />
              <p className="tt-dash__muted">Running the models on these inputs…</p>
            </div>
          ) : result ? (
            result.error ? (
              <div className="tt-sandbox-ml__error" role="alert">
                <p>{result.error}</p>
                <p className="tt-dash__muted">
                  The model service may be waking up. Wait about 30 seconds, then run the analysis again.
                </p>
              </div>
            ) : (
              <ResultView result={result} />
            )
          ) : (
            <div className="tt-sandbox-ml__placeholder">
              <p className="tt-dash__muted">Change the inputs or pick an example, then run the analysis.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
