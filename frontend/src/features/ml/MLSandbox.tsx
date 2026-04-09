import React, { useState } from 'react';

export function MLSandbox() {
  const [formData, setFormData] = useState({
    user_id: "SimulatedDemo",
    total_logons: 15,
    after_hours_logons: 5,
    total_emails: 40,
    emails_with_attachments: 12,
    total_http: 10500,
    suspicious_http: 18,
    total_file: 200,
    exe_zip_files: 4,
    total_device: 2
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Pointing strictly back to Render!
      // Warning: Chrome WILL throw a CORS error until api.py gets CORS headers injected!
      const response = await fetch('https://ml-api-2ru4.onrender.com/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setResult({ error: String(err) });
    }
    setLoading(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
    setFormData(prev => ({ ...prev, [e.target.name]: value }));
  };

  return (
    <div style={{ padding: '20px', background: '#111', color: '#fff', borderRadius: '8px', fontFamily: 'sans-serif' }}>
      <h2 style={{ borderBottom: '1px solid #333', paddingBottom: '10px' }}>🧪 AI Sandbox (Render API Proxy)</h2>
      <p style={{ color: '#aaa', fontSize: '14px' }}>
        This page entirely bypasses your SQL database. It sends the manual numbers below directly to your Render Machine Learning Cloud over the public internet to prove the AI works interactively.
      </p>
      
      <div style={{ display: 'flex', gap: '40px', marginTop: '20px' }}>
        {/* Form Column */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '350px' }}>
          {Object.entries(formData).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '14px', textTransform: 'capitalize' }}>
                {key.replace(/_/g, ' ')}
              </label>
              <input 
                name={key} 
                type={typeof val === 'number' ? 'number' : 'text'} 
                value={val} 
                onChange={handleChange} 
                style={{ 
                  width: '120px', 
                  padding: '5px', 
                  background: '#222', 
                  color: '#00cc66', 
                  border: '1px solid #444', 
                  borderRadius: '4px',
                  outline: 'none'
                }}
              />
            </div>
          ))}
          <button 
            type="submit" 
            disabled={loading} 
            style={{ 
              padding: '12px', 
              marginTop: '15px', 
              background: loading ? '#444' : '#00cc66', 
              color: '#000', 
              fontWeight: 'bold', 
              border: 'none', 
              borderRadius: '4px', 
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.3s'
            }}
          >
            {loading ? '🧠 AI is Thinking...' : 'Execute ML Prediction'}
          </button>
        </form>

        {/* Results Column */}
        <div style={{ flex: 1, padding: '20px', background: '#1a1a1a', borderRadius: '8px', border: '1px solid #333' }}>
          <h3 style={{ marginTop: 0, color: '#00cc66' }}>Engine Output</h3>
          {!result ? (
            <div style={{ color: '#555', fontStyle: 'italic', marginTop: '20px' }}>Awaiting input...</div>
          ) : (
            <pre style={{ 
              color: result.is_threat ? '#ff4d4d' : '#00cc66', 
              fontSize: '15px',
              whiteSpace: 'pre-wrap',
              wordWrap: 'break-word',
              background: '#000',
              padding: '15px',
              borderRadius: '6px',
              border: `1px solid ${result.is_threat ? '#ff4d4d' : '#00cc66'}`
            }}>
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
