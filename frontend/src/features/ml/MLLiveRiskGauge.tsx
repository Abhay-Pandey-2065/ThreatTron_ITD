import React, { useState, useEffect } from 'react';

interface MLLiveRiskGaugeProps {
  agentId?: string;
}

export function MLLiveRiskGauge({ agentId = "Global" }: MLLiveRiskGaugeProps) {
  const [riskData, setRiskData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRisk = async () => {
      try {
        // Ping the Brain Bridge on the local FastAPI backend!
        const response = await fetch(`http://127.0.0.1:8000/api/risk?agent_id=${agentId}`);
        const data = await response.json();
        setRiskData(data);
        setError(null);
      } catch (err) {
        setError("Cannot reach Backend API. Is Uvicorn running on Port 8000?");
      }
    };

    fetchRisk();
    // Refresh the score every 5 seconds to create a real-time tracking illusion
    const interval = setInterval(fetchRisk, 5000); 
    return () => clearInterval(interval);
  }, [agentId]);

  if (error) {
    return <div style={{ color: '#ff4d4d', padding: '10px', background: '#330000', borderRadius: '4px' }}>⚠️ {error}</div>;
  }
  
  if (!riskData) {
    return <div style={{ color: '#aaa', padding: '10px' }}>📡 Syncing with AI Brain...</div>;
  }

  const score = riskData.risk_score || 0;
  const percentage = Math.min(100, Math.max(0, score * 100));
  
  // Dynamic color scaler: Green -> Yellow -> Red based on the math
  const getColor = (p: number) => {
    if (p < 30) return '#00cc66'; // Safe (Green)
    if (p < 70) return '#ffcc00'; // Warning (Yellow)
    return '#ff4d4d'; // Danger (Red)
  };

  const activeColor = getColor(percentage);

  return (
    <div style={{ 
      padding: '24px', 
      background: '#111', 
      color: '#fff', 
      borderRadius: '12px', 
      fontFamily: 'sans-serif',
      boxShadow: `0 0 20px ${activeColor}33`, // Dynamic glowing shadow
      transition: 'box-shadow 0.5s ease-in-out'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#ccc' }}>Real-Time Threat Monitor</h3>
        <div style={{ 
          padding: '6px 16px', 
          borderRadius: '20px', 
          background: riskData.is_threat ? '#ffe6e6' : '#e6ffe6',
          color: riskData.is_threat ? '#ff4d4d' : '#00cc66',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          fontSize: '12px'
        }}>
          {riskData.is_threat ? "CRITICAL THREAT" : "SAFE"}
        </div>
      </div>

      <div style={{ textAlign: 'center', margin: '30px 0' }}>
        <h1 style={{ 
          fontSize: '64px', 
          margin: '0', 
          color: activeColor,
          transition: 'color 0.5s ease-in-out'
        }}>
          {percentage.toFixed(1)}%
        </h1>
        <div style={{ color: '#666', fontSize: '14px', marginTop: '5px' }}>
          Current Pipeline Risk Assessment
        </div>
      </div>
      
      {/* Target Progress Bar */}
      <div style={{ width: '100%', height: '14px', background: '#333', borderRadius: '7px', overflow: 'hidden' }}>
        <div style={{ 
          width: `${percentage}%`, 
          height: '100%', 
          background: activeColor,
          transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1), background 0.5s ease-in-out'
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '12px', color: '#555' }}>
        <span>Monitoring Agent: {riskData.user_id}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ 
            width: '8px', 
            height: '8px', 
            background: '#00cc66', 
            borderRadius: '50%',
            animation: 'pulse 2s infinite'
          }} />
          Live link: 5s Ping
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.3; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
