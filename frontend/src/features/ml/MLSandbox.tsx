import React, { useState } from 'react';

const FIELD_META: Record<string, { label: string; icon: string; description: string }> = {
  user_id:                  { label: 'User ID',                   icon: '👤', description: 'Employee identifier' },
  total_logons:             { label: 'Total Logons',              icon: '🔑', description: 'Total login events recorded' },
  after_hours_logons:       { label: 'After-Hours Logons',        icon: '🌙', description: 'Logins outside working hours' },
  total_emails:             { label: 'Total Emails',              icon: '📧', description: 'Total emails sent' },
  emails_with_attachments:  { label: 'Emails w/ Attachments',     icon: '📎', description: 'Emails carrying attachments' },
  total_http:               { label: 'Total HTTP Requests',       icon: '🌐', description: 'Total outbound web traffic' },
  suspicious_http:          { label: 'Suspicious HTTP',           icon: '⚠️', description: 'Requests to flagged domains' },
  total_file:               { label: 'Total File Ops',            icon: '📁', description: 'Total file read/write/move events' },
  exe_zip_files:            { label: 'EXE / ZIP Files',           icon: '🗜️', description: 'Executable or archive file events' },
  total_device:             { label: 'USB Device Events',         icon: '💾', description: 'External device connections' },
};

const PRESETS = {
  Normal:     { user_id: 'EMP_001', total_logons: 8,   after_hours_logons: 0,  weekend_logons: 0,  failed_logons: 1,  total_emails: 20,   emails_with_attachments: 2,   external_emails: 1,   total_http: 4000,  suspicious_http: 1,  total_file: 80,   exe_zip_files: 0,  total_device: 0 },
  Suspicious: { user_id: 'EMP_042', total_logons: 15,  after_hours_logons: 5,  weekend_logons: 3,  failed_logons: 4,  total_emails: 40,   emails_with_attachments: 12,  external_emails: 18,  total_http: 10500, suspicious_http: 18, total_file: 200,  exe_zip_files: 4,  total_device: 2 },
  Critical:   { user_id: 'EMP_099', total_logons: 120, after_hours_logons: 80, weekend_logons: 40, failed_logons: 25, total_emails: 5000, emails_with_attachments: 3000, external_emails: 4200, total_http: 90000, suspicious_http: 8000, total_file: 45000, exe_zip_files: 2000, total_device: 15 },
};

type PresetKey = keyof typeof PRESETS;

interface PredictionResult {
  user_id: string;
  risk_score: number;
  is_threat: boolean;
  sub_scores: { lightgbm_confidence: number; anomaly_confidence: number };
  status: string;
  error?: string;
}

function RiskMeter({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 100));
  const color = pct < 30 ? '#22c55e' : pct < 65 ? '#f59e0b' : '#ef4444';
  const label = pct < 30 ? 'LOW RISK' : pct < 65 ? 'MEDIUM RISK' : 'HIGH RISK — THREAT DETECTED';

  return (
    <div style={{ textAlign: 'center', padding: '24px 0 16px' }}>
      {/* Big score number */}
      <div style={{ fontSize: '72px', fontWeight: 800, color, lineHeight: 1, letterSpacing: '-2px', transition: 'color 0.5s' }}>
        {(score).toFixed(4)}
      </div>
      <div style={{ fontSize: '13px', color: '#666', marginTop: 4, letterSpacing: '1px' }}>COMPOSITE RISK SCORE</div>

      {/* Gradient bar */}
      <div style={{ margin: '20px auto 8px', maxWidth: 420, height: 10, borderRadius: 5, background: 'linear-gradient(to right, #22c55e, #f59e0b, #ef4444)', position: 'relative' }}>
        <div style={{
          position: 'absolute',
          left: `calc(${pct}% - 7px)`,
          top: -5,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: color,
          border: '3px solid #0d0d0d',
          boxShadow: `0 0 10px ${color}`,
          transition: 'left 0.8s cubic-bezier(0.4,0,0.2,1)',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', maxWidth: 420, margin: '0 auto', fontSize: 11, color: '#555' }}>
        <span>0.0 Safe</span><span>0.5 Medium</span><span>1.0 Critical</span>
      </div>

      {/* Status badge */}
      <div style={{
        display: 'inline-block',
        marginTop: 18,
        padding: '6px 20px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '1.5px',
        background: color + '22',
        color,
        border: `1px solid ${color}55`,
        textTransform: 'uppercase',
      }}>
        {label}
      </div>
    </div>
  );
}

function SubScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#aaa', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ color, fontWeight: 700 }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 6, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
    </div>
  );
}

export function MLSandbox() {
  const [formData, setFormData] = useState(PRESETS.Suspicious);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('Suspicious');

  const handlePreset = (key: PresetKey) => {
    setFormData(PRESETS[key]);
    setActivePreset(key);
    setResult(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch('https://ml-api-2ru4.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ user_id: formData.user_id, risk_score: 0, is_threat: false, sub_scores: { lightgbm_confidence: 0, anomaly_confidence: 0 }, status: 'error', error: String(err) });
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
    setActivePreset('' as PresetKey);
  };

  const presetColors: Record<PresetKey, string> = { Normal: '#22c55e', Suspicious: '#f59e0b', Critical: '#ef4444' };

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#e5e5e5' }}>

      {/* Preset Selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        {(Object.keys(PRESETS) as PresetKey[]).map(key => (
          <button key={key} onClick={() => handlePreset(key)} style={{
            padding: '7px 18px', borderRadius: 8, border: `1.5px solid ${activePreset === key ? presetColors[key] : '#2a2a2a'}`,
            background: activePreset === key ? presetColors[key] + '18' : '#141414',
            color: activePreset === key ? presetColors[key] : '#666', fontWeight: 600, fontSize: 13,
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {key === 'Normal' ? '🟢' : key === 'Suspicious' ? '🟡' : '🔴'} {key} Employee
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* LEFT: Input Form */}
        <div style={{ background: '#0f0f0f', borderRadius: 12, border: '1px solid #1e1e1e', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>📊 Behavioural Parameters</span>
          </div>
          <form onSubmit={handleSubmit} style={{ padding: '16px 20px' }}>
            {Object.entries(formData).map(([key, val]) => {
              const meta = FIELD_META[key] || { label: key, icon: '•', description: '' };
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 10 }}>
                  <span style={{ width: 22, textAlign: 'center', fontSize: 15 }}>{meta.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>{meta.label}</div>
                  </div>
                  <input
                    name={key}
                    type={typeof val === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={handleChange}
                    min={0}
                    style={{
                      width: 100, padding: '5px 8px', background: '#1a1a1a',
                      color: '#e5e5e5', border: '1px solid #2a2a2a', borderRadius: 6,
                      fontSize: 13, outline: 'none', textAlign: 'right',
                    }}
                  />
                </div>
              );
            })}
            <button type="submit" disabled={loading} style={{
              width: '100%', marginTop: 12, padding: '11px', borderRadius: 8, border: 'none',
              background: loading ? '#1e1e1e' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: loading ? '#555' : '#fff', fontWeight: 700, fontSize: 14,
              cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px',
              transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid #555', borderTopColor: '#888', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} /> Analysing Behaviour...</>
              ) : '⚡ Run Threat Analysis'}
            </button>
          </form>
        </div>

        {/* RIGHT: Results Panel */}
        <div style={{ background: '#0f0f0f', borderRadius: 12, border: '1px solid #1e1e1e', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #1e1e1e' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ccc' }}>🎯 Model Output</span>
          </div>
          <div style={{ padding: '16px 20px' }}>
            {!result && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12 }}>
                <div style={{ fontSize: 40 }}>🧠</div>
                <div style={{ color: '#444', fontSize: 14 }}>Submit parameters to run inference</div>
              </div>
            )}
            {loading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 320, gap: 12 }}>
                <div style={{ width: 40, height: 40, border: '3px solid #1e1e1e', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <div style={{ color: '#555', fontSize: 13 }}>Running ensemble inference across 4 models...</div>
              </div>
            )}
            {result && !loading && (
              <>
                {result.error ? (
                  <div style={{ color: '#ef4444', background: '#1a0000', padding: 16, borderRadius: 8, fontSize: 13 }}>
                    ⚠️ {result.error}. <br /><br />
                    <span style={{ color: '#888' }}>Hint: The Render API may need a 30-second cold start. Wait and try again.</span>
                  </div>
                ) : (
                  <>
                    <RiskMeter score={result.risk_score} />
                    <div style={{ borderTop: '1px solid #1a1a1a', marginTop: 16, paddingTop: 16 }}>
                      <div style={{ fontSize: 12, color: '#555', marginBottom: 12, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Model Sub-Scores</div>
                      <SubScoreBar label="🌲 LightGBM Gradient Boosting" value={result.sub_scores.lightgbm_confidence} color="#6366f1" />
                      <SubScoreBar label="🔍 Isolation Forest Anomaly" value={result.sub_scores.anomaly_confidence} color="#f59e0b" />
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                      <div style={{ flex: 1, background: '#141414', borderRadius: 8, padding: '10px 14px', border: '1px solid #1e1e1e' }}>
                        <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>TARGET USER</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc' }}>{result.user_id}</div>
                      </div>
                      <div style={{ flex: 1, background: '#141414', borderRadius: 8, padding: '10px 14px', border: '1px solid #1e1e1e' }}>
                        <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>API STATUS</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>✓ {result.status}</div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
      `}</style>
    </div>
  );
}
