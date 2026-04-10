import { useState, useEffect, useRef } from 'react';
import { fetchLiveRisk, type RiskResponse } from '../../lib/api';

interface MLLiveRiskGaugeProps {
  agentId?: string;
}

const RULE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  USB_FILE_EXFIL:         { label: 'USB + File Exfiltration',         color: '#ef4444', icon: '💾' },
  SUSPICIOUS_WEB_STAGING: { label: 'Suspicious Web + File Staging',   color: '#f59e0b', icon: '🌐' },
  EMAIL_EXFILTRATION:     { label: 'Email Data Leakage',              color: '#f59e0b', icon: '📧' },
  FULL_KILL_CHAIN:        { label: 'Full Kill Chain Detected',        color: '#ef4444', icon: '🚨' },
  SUSPICIOUS_FILE_TYPES:  { label: 'Suspicious File Types (.exe/.zip)', color: '#a78bfa', icon: '📁' },
  AFTER_HOURS_EXFIL:      { label: 'After-Hours Data Exfiltration',  color: '#f59e0b', icon: '🕛' },
  MASS_RECIPIENT_SPRAY:   { label: 'Mass Email Spray Detected',      color: '#ef4444', icon: '📤' },
};



const MODELS = [
  { key: 'lightgbm_confidence', label: '🌲 LightGBM',          color: '#6366f1' },
  { key: 'rf_confidence',       label: '🌳 Random Forest',      color: '#10b981' },
  { key: 'lr_confidence',       label: '📈 Logistic Regression', color: '#3b82f6' },
  { key: 'anomaly_confidence',  label: '🔍 Isolation Forest',   color: '#f59e0b',
    tooltip: 'Flags statistical anomalies — high score means behaviour deviates strongly from baseline even if no named rule fired.' },
];

function ArcGauge({ pct, color }: { pct: number; color: string }) {
  const r = 70, cx = 90, cy = 90;
  const circumference = Math.PI * r;
  const dash = (pct / 100) * circumference;
  return (
    <svg width="180" height="100" viewBox="0 0 180 100">
      <defs>
        <filter id="glow-live">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1e1e1e" strokeWidth="12" strokeLinecap="round" />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`} filter="url(#glow-live)"
        style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s' }} />
    </svg>
  );
}

function InfoCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{ background: '#141414', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e1e1e', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#ccc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#444', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}

function ModelBar({ label, value, color, tooltip }: { label: string; value: number; color: string; tooltip?: string }) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={{ marginBottom: 10, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 3, alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {label}
          {tooltip && (
            <span
              onMouseEnter={() => setShowTip(true)}
              onMouseLeave={() => setShowTip(false)}
              style={{ fontSize: 10, color: '#444', cursor: 'help', border: '1px solid #333', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >?</span>
          )}
        </span>
        <span style={{ color, fontWeight: 700 }}>{(value * 100).toFixed(1)}%</span>
      </div>
      <div style={{ height: 5, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: 3, transition: 'width 1s ease' }} />
      </div>
      {showTip && tooltip && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, right: 0, zIndex: 10,
          background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6,
          padding: '8px 10px', fontSize: 11, color: '#aaa', marginBottom: 6,
          boxShadow: '0 4px 20px #00000066',
        }}>{tooltip}</div>
      )}
    </div>
  );
}

export function MLLiveRiskGauge({ agentId = 'Global' }: MLLiveRiskGaugeProps) {
  const [riskData, setRiskData]   = useState<RiskResponse | null>(null);
  const [offline, setOffline]     = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [window, setWindow]       = useState(30);
  const prevScore                 = useRef<number>(0);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const data = await fetchLiveRisk(agentId, window);
        prevScore.current = riskData?.risk_score ?? 0;
        setRiskData(data);
        setOffline(false);
        setLastUpdate(new Date());
      } catch {
        setOffline(true);
      }
    };
    fetchRisk();
    const id = setInterval(fetchRisk, 5000);
    return () => clearInterval(id);
  }, [agentId, window]);

  const score  = riskData?.risk_score ?? 0;
  const pct    = Math.min(100, Math.max(0, score * 100));
  const color  = pct < 30 ? '#22c55e' : pct < 65 ? '#f59e0b' : '#ef4444';
  const label  = pct < 30 ? 'SAFE' : pct < 65 ? 'ELEVATED' : 'CRITICAL';
  const trend  = riskData?.trend ?? '→';
  const trendColor = trend === '↑' ? '#ef4444' : trend === '↓' ? '#22c55e' : '#555';

  const lastAlertFormatted = riskData?.last_alert
    ? new Date(riskData.last_alert).toLocaleTimeString(undefined, { timeStyle: 'short' })
    : null;

  return (
    <div style={{
      background: '#0f0f0f', borderRadius: 14,
      border: `1px solid ${offline ? '#2a1a1a' : '#1e1e1e'}`,
      overflow: 'hidden', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#e5e5e5',
      boxShadow: offline ? 'none' : `0 0 30px ${color}18`, transition: 'box-shadow 0.5s',
    }}>

      {/* ── Header ── */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: offline ? '#444' : '#22c55e',
            display: 'inline-block',
            boxShadow: offline ? 'none' : '0 0 6px #22c55e',
            animation: offline ? 'none' : 'pulse 2s infinite',
          }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: '#ccc' }}>Live Threat Monitor</span>
          
          <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 4, background: '#0a0a0a', padding: '2px', borderRadius: 6, border: '1px solid #1a1a1a' }}>
            {[15, 30, 60].map(v => (
              <button
                key={v}
                onClick={() => setWindow(v)}
                title={`Analyze last ${v} minutes`}
                style={{
                  background: window === v ? '#1a1a1a' : 'transparent',
                  border: 'none',
                  color: window === v ? '#6366f1' : '#444',
                  fontSize: 9,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {v}M
              </button>
            ))}
          </div>
        </div>

        <div style={{ fontSize: 11, color: '#444', display: 'flex', gap: 10 }}>
          {offline ? '⚡ Backend Offline' : (
            <>
              <span style={{ color: '#555' }}>Live Stream Active</span>
              {lastUpdate && (
                <span style={{ color: '#333' }}>
                  | &nbsp; Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Arc Gauge ── */}
        <div style={{ textAlign: 'center', position: 'relative', minWidth: 180 }}>
          <ArcGauge pct={pct} color={color} />
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, transition: 'color 0.5s' }}>
              {score.toFixed(3)}
            </div>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: '1px', marginTop: 2 }}>RISK SCORE</div>
          </div>

          {/* Trend badge under gauge */}
          <div style={{ marginTop: 8, fontSize: 18, color: trendColor, fontWeight: 700, letterSpacing: '1px' }}
            title={trend === '↑' ? 'Score rising' : trend === '↓' ? 'Score falling' : 'Score stable'}>
            {trend}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <div>
          {/* Status chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20,
              background: color + '18', color, border: `1px solid ${color}44`,
              fontWeight: 700, fontSize: 12, letterSpacing: '1.5px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', animation: offline ? 'none' : 'pulse 2s infinite' }} />
              {offline ? 'OFFLINE' : label}
            </div>
            {riskData?.event_count !== undefined && !offline && (
              <span style={{ fontSize: 11, color: '#444' }}>
                Based on <span style={{ color: '#666', fontWeight: 600 }}>{riskData.event_count.toLocaleString()}</span> events
              </span>
            )}
          </div>

          {/* Info cards: Agent ID, Hostname, ML Score, Rule Score */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
            <InfoCard
              label="Agent ID"
              value={riskData?.user_id || agentId}
            />
            <InfoCard
              label="Hostname"
              value={riskData?.hostname || '—'}
            />
            <InfoCard
              label="ML Score"
              value={riskData?.ml_score?.toFixed(3) ?? '—'}
            />
            <InfoCard
              label="Rule Score"
              value={riskData?.rule_score?.toFixed(3) ?? '—'}
            />
          </div>

          {/* Last Alert */}
          <div style={{ marginBottom: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              flex: 1, padding: '7px 12px', borderRadius: 6,
              background: lastAlertFormatted ? '#f59e0b0f' : '#0a0a0a',
              border: `1px solid ${lastAlertFormatted ? '#f59e0b22' : '#1a1a1a'}`,
              fontSize: 12, color: lastAlertFormatted ? '#f59e0b' : '#333',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {lastAlertFormatted
                ? <><span>⏱</span> Last alert at <strong>{lastAlertFormatted}</strong> this session</>
                : <><span>✅</span> No alerts triggered in this session</>
              }
            </div>
          </div>

          {/* Rules Triggered */}
          {riskData?.rules_triggered && riskData.rules_triggered.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 8, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                🚨 Attack Patterns Detected
              </div>
              {riskData.rules_triggered.map(rule => {
                const meta = RULE_LABELS[rule] || { label: rule, color: '#888', icon: '⚠️' };
                return (
                  <div key={rule} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                    marginBottom: 4, borderRadius: 6,
                    background: meta.color + '12', border: `1px solid ${meta.color}33`,
                  }}>
                    <span>{meta.icon}</span>
                    <span style={{ fontSize: 12, color: meta.color, fontWeight: 600 }}>{meta.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Model Breakdown — all 4 models */}
          {riskData?.sub_scores && (
            <div>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 10, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                Model Breakdown
              </div>
              {MODELS.map(m => (
                <ModelBar
                  key={m.key}
                  label={m.label}
                  value={(riskData.sub_scores as Record<string, number>)[m.key] ?? 0}
                  color={m.color}
                  tooltip={m.tooltip}
                />
              ))}
            </div>
          )}

          {offline && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 8, padding: '8px 12px', background: '#141414', borderRadius: 6, border: '1px solid #1e1e1e' }}>
              Run <code style={{ color: '#6366f1' }}>python -m uvicorn main:app --port 8000</code> in the backend folder to enable live tracking.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
      `}</style>
    </div>
  );
}
