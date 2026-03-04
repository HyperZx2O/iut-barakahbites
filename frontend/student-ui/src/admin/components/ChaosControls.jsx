import { useState } from 'react';
import api from '../../api';

const services = [
  { name: 'Identity Provider', label: 'Login Service', icon: '🔐', base: import.meta.env.VITE_AUTH_URL || 'http://localhost:3001' },
  { name: 'Order Gateway', label: 'Order Gateway', icon: '🛒', base: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002' },
  { name: 'Stock Service', label: 'Inventory Manager', icon: '📦', base: import.meta.env.VITE_STOCK_URL || 'http://localhost:3003' },
  { name: 'Kitchen Queue', label: 'Kitchen Display', icon: '🍳', base: import.meta.env.VITE_KITCHEN_URL || 'http://localhost:3004' },
  { name: 'Notification Hub', label: 'Alert System', icon: '🔔', base: import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:3005' },
];

/* Shared neomorphic button factory */
function ChaosBtn({ label, colorRgb, onClick }) {
  const base = `rgba(${colorRgb}, 0.4)`;
  const hover = `rgba(${colorRgb}, 0.65)`;

  const bsRest = `8px 8px 20px rgba(0,0,0,0.5), -5px -5px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.15)`;
  const bsHover = `10px 10px 26px rgba(0,0,0,0.5), -6px -6px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px rgba(${colorRgb}, 0.18)`;
  const bsDown = `inset 6px 6px 16px rgba(0,0,0,0.45), inset -4px -4px 12px rgba(0,0,0,0.05), 0 0 10px rgba(${colorRgb}, 0.1)`;

  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.09em',
        color: '#FFD6B6',
        background: 'transparent',
        border: `1.5px solid ${base}`,
        borderRadius: '10px',
        padding: '7px 14px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        textShadow: `0 0 8px rgba(${colorRgb}, 0.55), 0 2px 4px rgba(0,0,0,0.7)`,
        boxShadow: bsRest,
        transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = hover;
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = bsHover;
        e.currentTarget.style.textShadow = `0 0 12px rgba(${colorRgb}, 0.75), 0 2px 4px rgba(0,0,0,0.8)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = base;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = bsRest;
        e.currentTarget.style.textShadow = `0 0 8px rgba(${colorRgb}, 0.55), 0 2px 4px rgba(0,0,0,0.7)`;
      }}
      onMouseDown={e => {
        e.currentTarget.style.transform = 'translateY(1px)';
        e.currentTarget.style.boxShadow = bsDown;
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = bsHover;
      }}
    >
      {label}
    </button>
  );
}

export default function ChaosControls() {
  const [status, setStatus] = useState('');

  const call = async (svc, action) => {
    try {
      await api.post(`${svc.base}/admin/${action}`);
      setStatus(`${svc.label} ${action === 'revive' ? 'revived' : 'killed'} ✓`);
    } catch {
      setStatus(`Failed to ${action} ${svc.label}`);
    }
    setTimeout(() => setStatus(''), 3000);
  };

  return (
    <section className="neomorph-card enter" style={{ padding: '24px' }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '3px', height: '22px', background: '#B74242', borderRadius: '9999px', display: 'block' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>Chaos Controls</h2>
        </div>
        {status && (
          <p style={{
            fontSize: '10px',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 12px',
            borderRadius: '8px',
            background: 'rgba(255,214,182,0.08)',
            color: '#FFD6B6',
            border: '1px solid rgba(255,214,182,0.2)',
          }}>
            {status}
          </p>
        )}
      </div>

      {/* Service rows — HORIZONTAL layout like menu items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {services.map((svc) => (
          <div
            key={svc.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '12px',
              background: 'linear-gradient(145deg, rgba(140,50,50,0.8) 0%, rgba(100,35,35,0.75) 100%)',
              border: '1px solid rgba(234,115,98,0.08)',
              boxShadow: '6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(183,66,66,0.07), inset 0 1px 0 rgba(255,214,182,0.04)',
              transition: 'border-color 0.3s ease',
            }}
          >
            {/* Left: icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{svc.icon}</span>
              <span style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#FFD6B6',
                fontFamily: "'DM Sans', system-ui, sans-serif",
                whiteSpace: 'nowrap',
              }}>
                {svc.label}
              </span>
            </div>

            {/* Right: buttons with gap */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {/* Simulate Kill — red */}
              <ChaosBtn
                label="Simulate Kill"
                colorRgb="239, 68, 68"
                onClick={() => call(svc, 'kill')}
              />
              {/* Revive — green */}
              <ChaosBtn
                label="Revive"
                colorRgb="34, 197, 94"
                onClick={() => call(svc, 'revive')}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
