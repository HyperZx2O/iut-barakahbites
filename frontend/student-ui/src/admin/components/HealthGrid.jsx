import { useEffect, useState } from 'react';
import api from '../../api';

const services = [
  { name: 'Identity Provider', label: 'Login Service', icon: '🔐', base: import.meta.env.VITE_AUTH_URL || 'http://localhost:3001' },
  { name: 'Order Gateway', label: 'Order Gateway', icon: '🛒', base: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002' },
  { name: 'Stock Service', label: 'Inventory Manager', icon: '📦', base: import.meta.env.VITE_STOCK_URL || 'http://localhost:3003' },
  { name: 'Kitchen Queue', label: 'Kitchen Display', icon: '🍳', base: import.meta.env.VITE_KITCHEN_URL || 'http://localhost:3004' },
  { name: 'Notification Hub', label: 'Alert System', icon: '🔔', base: import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:3005' },
];

/* Neomorphic extruded button — same shadow language as btn-primary but tinted */
function StatusBadge({ state }) {
  const isUp = state === 'up';
  const isPending = state === undefined;

  if (isPending) {
    return (
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 700,
        fontSize: '9px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'rgba(255,214,182,0.45)',
        background: 'transparent',
        border: '1.5px solid rgba(255,214,182,0.2)',
        borderRadius: '8px',
        padding: '4px 10px',
        boxShadow: '4px 4px 10px rgba(0,0,0,0.4), -3px -3px 8px rgba(183,66,66,0.05), inset 0 1px 0 rgba(255,214,182,0.03)',
      }}>
        …
      </span>
    );
  }

  if (isUp) {
    return (
      <span style={{
        fontFamily: "'DM Sans', sans-serif",
        fontWeight: 800,
        fontSize: '9px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: '#4ade80',
        background: 'transparent',
        border: '1.5px solid rgba(34, 197, 94, 0.45)',
        borderRadius: '8px',
        padding: '4px 10px',
        textShadow: '0 0 8px rgba(74, 222, 128, 0.6), 0 0 2px rgba(0,0,0,0.5)',
        boxShadow: '6px 6px 16px rgba(0,0,0,0.45), -4px -4px 12px rgba(34,197,94,0.06), inset 0 1px 0 rgba(74,222,128,0.06), 0 0 10px rgba(34,197,94,0.12)',
        whiteSpace: 'nowrap',
      }}>
        ONLINE
      </span>
    );
  }

  return (
    <span style={{
      fontFamily: "'DM Sans', sans-serif",
      fontWeight: 800,
      fontSize: '9px',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: '#f87171',
      background: 'transparent',
      border: '1.5px solid rgba(239, 68, 68, 0.45)',
      borderRadius: '8px',
      padding: '4px 10px',
      textShadow: '0 0 8px rgba(248, 113, 113, 0.6), 0 0 2px rgba(0,0,0,0.5)',
      boxShadow: '6px 6px 16px rgba(0,0,0,0.45), -4px -4px 12px rgba(239,68,68,0.06), inset 0 1px 0 rgba(248,113,113,0.06), 0 0 10px rgba(239,68,68,0.12)',
      whiteSpace: 'nowrap',
    }}>
      OFFLINE
    </span>
  );
}

const BOX_MIN_W = '320px';

export default function HealthGrid() {
  const [health, setHealth] = useState({});

  const poll = async () => {
    const results = {};
    await Promise.all(
      services.map(async (svc) => {
        try {
          const r = await api.get(`${svc.base}/health`);
          results[svc.name] = (r.data.alive !== false && (r.data.status === 'ok' || r.data.status === 'degraded')) ? 'up' : 'down';
        } catch {
          results[svc.name] = 'down';
        }
      })
    );
    setHealth(results);
  };

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section
      className="neomorph-card enter"
      style={{ flex: 1, minWidth: BOX_MIN_W, maxWidth: '100%', padding: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexShrink: 0 }}>
        <span style={{ width: '3px', height: '22px', background: '#EA7362', borderRadius: '9999px', display: 'block' }} />
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>Service Health</h2>
      </div>

      {/* Service rows — full-width column, each row gets equal flex share */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        flex: 1,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(234,115,98,0.3) transparent',
      }}>
        {services.map((svc) => {
          const isUp = health[svc.name] === 'up';
          const isPending = health[svc.name] === undefined;
          const active = isUp;

          return (
            <div
              key={svc.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0 16px',
                borderRadius: '12px',
                flex: 1,                 /* ← each row shares equal height */
                background: active
                  ? 'linear-gradient(145deg, rgba(34,197,94,0.1) 0%, rgba(140,50,50,0.85) 100%)'
                  : isPending
                    ? 'linear-gradient(145deg, rgba(140,50,50,0.8) 0%, rgba(100,35,35,0.75) 100%)'
                    : 'linear-gradient(145deg, rgba(239,68,68,0.08) 0%, rgba(100,35,35,0.8) 100%)',
                border: active
                  ? '1px solid rgba(34,197,94,0.25)'
                  : isPending
                    ? '1px solid rgba(234,115,98,0.08)'
                    : '1px solid rgba(239,68,68,0.2)',
                boxShadow: active
                  ? '0 0 12px rgba(34,197,94,0.08), 6px 6px 16px rgba(0,0,0,0.5)'
                  : '6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(183,66,66,0.07)',
                transition: 'all 0.3s ease',
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>{svc.icon}</span>

              {/* Label + port */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: 1.2, whiteSpace: 'nowrap' }}>
                  {svc.label}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,214,182,0.45)', fontFamily: 'JetBrains Mono, monospace', marginTop: '2px' }}>
                  :{new URL(svc.base).port}
                </div>
              </div>

              {/* Status badge */}
              <StatusBadge state={health[svc.name]} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
