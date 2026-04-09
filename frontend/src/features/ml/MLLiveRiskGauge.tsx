import { useState, useEffect } from 'react';

interface MLLiveRiskGaugeProps {
  agentId?: string;
}

interface RiskResponse {
  user_id?: string;
  risk_score?: number;
  is_threat?: boolean;
  sub_scores?: { lightgbm_confidence: number; anomaly_confidence: number };
  status?: string;
  message?: string;
}

function ArcGauge({ pct, color }: { pct: number; color: string }) {
  const r = 70;
  const cx = 90, cy = 90;
  const circumference = Math.PI * r; // half circle
  const dash = (pct / 100) * circumference;

  return (
    <svg width="180" height="100" viewBox="0 0 180 100">
      {/* Background arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#1e1e1e" strokeWidth="12" strokeLinecap="round" />
      {/* Foreground arc */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`} style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1), stroke 0.5s' }} />
      {/* Glow filter */}
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
    </svg>
  );
}

export function MLLiveRiskGauge({ agentId = 'Global' }: MLLiveRiskGaugeProps) {
  const [riskData, setRiskData] = useState<RiskResponse | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/risk?agent_id=${agentId}`);
        const data = await response.json();
        setRiskData(data);
        setOffline(false);
        setLastUpdate(new Date());
      } catch {
        setOffline(true);
      }
      setTick(t => t + 1);
    };
    fetchRisk();
    const interval = setInterval(fetchRisk, 5000);
    return () => clearInterval(interval);
  }, [agentId]);

  const score = riskData?.risk_score ?? 0;
  const pct = Math.min(100, Math.max(0, score * 100));
  const color = pct < 30 ? '#22c55e' : pct < 65 ? '#f59e0b' : '#ef4444';
  const label = pct < 30 ? 'SAFE' : pct < 65 ? 'ELEVATED' : 'CRITICAL';

  const nextRefreshIn = 5 - (tick % 5 === 0 ? 5 : tick % 5);

  return (
    <div style={{
      background: '#0f0f0f', borderRadius: 14, border: `1px solid ${offline ? '#2a1a1a' : '#1e1e1e'}`,
      overflow: 'hidden', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#e5e5e5',
      boxShadow: offline ? 'none' : `0 0 30px ${color}18`, transition: 'box-shadow 0.5s',
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: offline ? '#444' : '#22c55e',
            display: 'inline-block',
            boxShadow: offline ? 'none' : '0 0 6px #22c55e',
            animation: offline ? 'none' : 'pulse 2s infinite',
          }} />
          <span style={{ fontWeight: 600, fontSize: 14, color: '#ccc' }}>Live Threat Monitor</span>
        </div>
        <div style={{ fontSize: 12, color: '#444' }}>
          {offline ? '⚡ Backend Offline' : lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString()}` : 'Syncing...'}
        </div>
      </div>

      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'center' }}>

        {/* Arc Gauge */}
        <div style={{ textAlign: 'center', position: 'relative', minWidth: 180 }}>
          <ArcGauge pct={pct} color={color} />
          <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, transition: 'color 0.5s' }}>
              {(score).toFixed(3)}
            </div>
            <div style={{ fontSize: 10, color: '#555', letterSpacing: '1px', marginTop: 2 }}>RISK SCORE</div>
          </div>
        </div>

        {/* Right Panel */}
        <div>
          {/* Status badge */}
          <div style={{
            display: 'inline-block', padding: '6px 16px', borderRadius: 20,
            background: color + '18', color, border: `1px solid ${color}44`,
            fontWeight: 700, fontSize: 12, letterSpacing: '1.5px', marginBottom: 16,
          }}>
            {offline ? '— OFFLINE' : label}
          </div>

          {/* Agent Info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Agent ID', value: riskData?.user_id || agentId },
              { label: 'Refresh', value: `5s interval` },
            ].map(item => (
              <div key={item.label} style={{ background: '#141414', borderRadius: 8, padding: '10px 12px', border: '1px solid #1e1e1e' }}>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#bbb' }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* Sub-score bars */}
          {riskData?.sub_scores && (
            <div>
              <div style={{ fontSize: 11, color: '#444', marginBottom: 10, letterSpacing: '0.8px', textTransform: 'uppercase' }}>Model Breakdown</div>
              {[
                { label: 'LightGBM', value: riskData.sub_scores.lightgbm_confidence, color: '#6366f1' },
                { label: 'Isolation Forest', value: riskData.sub_scores.anomaly_confidence, color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', marginBottom: 3 }}>
                    <span>{s.label}</span>
                    <span style={{ color: s.color, fontWeight: 700 }}>{(s.value * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 5, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${s.value * 100}%`, height: '100%', background: s.color, borderRadius: 3, transition: 'width 1s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {offline && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 8, padding: '8px 12px', background: '#141414', borderRadius: 6, border: '1px solid #1e1e1e' }}>
              Start Uvicorn backend on Port 8000 to enable live tracking.
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
