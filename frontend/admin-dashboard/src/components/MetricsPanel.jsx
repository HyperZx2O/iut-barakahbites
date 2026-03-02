import { useEffect, useState } from 'react';
import api from '../api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const services = [
  {
    name: 'Stock Service',
    label: 'Inventory Manager',
    icon: '📦',
    base: import.meta.env.VITE_STOCK_URL || 'http://localhost:3003',
    description: 'Stock look-up & update latency',
    color: '#EA7362',
    thresholdMs: 200,
  },
  {
    name: 'Order Gateway',
    label: 'Order Gateway',
    icon: '🛒',
    base: import.meta.env.VITE_GATEWAY_URL || 'http://localhost:3002',
    description: 'Order processing & routing latency',
    color: '#a78bfa',
    thresholdMs: 300,
  },
];

const CustomTooltip = ({ active, payload, label, color }) => {
  if (active && payload && payload.length && payload[0].value != null) {
    return (
      <div style={{
        background: 'linear-gradient(145deg,rgba(120,45,45,0.97) 0%,rgba(92,38,38,0.95) 100%)',
        border: `1px solid ${color}40`,
        borderRadius: '10px',
        padding: '6px 12px',
        fontSize: '11px',
        fontFamily: 'JetBrains Mono, monospace',
        color: '#FFD6B6',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      }}>
        <p style={{ color, marginBottom: '2px', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
        <p style={{ fontSize: '13px', fontWeight: 700 }}>{payload[0].value.toFixed(1)} <span style={{ fontSize: '9px', opacity: 0.7 }}>ms</span></p>
      </div>
    );
  }
  return null;
};

const BOX_MIN_W = '320px';

export default function MetricsPanel() {
  const [series, setSeries] = useState({});
  const [stats, setStats] = useState({});

  const fetchMetrics = async () => {
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    await Promise.all(services.map(async (svc) => {
      try {
        const r = await api.get(`${svc.base}/metrics`);
        const d = r.data;

        const latency = d.averageLatencyMs ?? d.latency ?? 0;
        const requests = d.totalRequests ?? d.requestCount ?? null;
        const errors = d.errorCount ?? d.errors ?? null;
        const uptime = d.uptimeSeconds != null ? d.uptimeSeconds : null;
        const p95 = d.p95LatencyMs ?? d.p95 ?? null;
        const queueLen = d.queueLength ?? d.pending ?? null;

        setStats(prev => ({
          ...prev,
          [svc.name]: { latency, requests, errors, uptime, p95, queueLen },
        }));

        setSeries(prev => {
          const arr = prev[svc.name] ?? [];
          return {
            ...prev,
            [svc.name]: [...arr, { time: ts, value: latency }].slice(-20),
          };
        });
      } catch {
        setStats(prev => ({
          ...prev,
          [svc.name]: { latency: null, requests: null, errors: null, uptime: null, p95: null, queueLen: null },
        }));
        setSeries(prev => ({
          ...prev,
          [svc.name]: [...(prev[svc.name] ?? []), { time: ts, value: null }].slice(-20),
        }));
      }
    }));
  };

  useEffect(() => {
    fetchMetrics();
    const id = setInterval(fetchMetrics, 3000);
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
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif" }}>Network Performance</h2>
      </div>

      {/* Service cards — scrollable column */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(234,115,98,0.3) transparent',
      }}>
        {services.map((svc) => {
          const data = series[svc.name] ?? [];
          const info = stats[svc.name] ?? {};
          const hasData = data.some(d => d.value != null);
          const isHealthy = info.latency != null && info.latency < svc.thresholdMs;
          const latencyColor = info.latency == null ? 'rgba(255,214,182,0.4)' : isHealthy ? '#4ade80' : '#f87171';

          return (
            <div
              key={svc.name}
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, rgba(140,50,50,0.85) 0%, rgba(100,35,35,0.8) 100%)',
                border: `1px solid ${svc.color}30`,
                boxShadow: `6px 6px 18px rgba(0,0,0,0.5), 0 0 14px ${svc.color}10`,
                flexShrink: 0,
              }}
            >
              {/* Top progress bar — latency health indicator */}
              <div style={{
                height: '3px',
                background: `linear-gradient(90deg, ${svc.color} 0%, ${svc.color}60 100%)`,
                width: info.latency != null ? `${Math.min(100, (info.latency / svc.thresholdMs) * 100)}%` : '0%',
                transition: 'width 0.8s ease',
              }} />

              <div style={{ padding: '12px 14px 14px' }}>

                {/* Row 1: icon + name + latency value */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '15px', lineHeight: 1 }}>{svc.icon}</span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#FFD6B6', fontFamily: "'DM Sans', system-ui, sans-serif", lineHeight: 1.2 }}>{svc.label}</div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,214,182,0.4)', fontFamily: 'Montserrat, sans-serif', marginTop: '1px' }}>{svc.description}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: latencyColor, fontFamily: 'JetBrains Mono, monospace', lineHeight: 1, textShadow: `0 0 8px ${latencyColor}60` }}>
                      {info.latency != null ? `${info.latency.toFixed(0)}` : '—'}
                    </div>
                    <div style={{ fontSize: '9px', color: 'rgba(255,214,182,0.4)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>
                      {info.latency != null ? 'ms avg' : 'offline'}
                    </div>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,214,182,0.05)', marginBottom: '8px' }} />

                {/* Row 2: stat pills */}
                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  {info.requests != null && (
                    <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', background: `${svc.color}15`, border: `1px solid ${svc.color}30`, color: svc.color, borderRadius: '6px', padding: '2px 8px', letterSpacing: '0.03em' }}>
                      {info.requests} req
                    </span>
                  )}
                  {info.errors != null && (
                    <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', background: info.errors > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(74,222,128,0.08)', border: info.errors > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(74,222,128,0.25)', color: info.errors > 0 ? '#f87171' : '#4ade80', borderRadius: '6px', padding: '2px 8px' }}>
                      {info.errors === 0 ? '✓ no errors' : `${info.errors} err`}
                    </span>
                  )}
                  {info.p95 != null && (
                    <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,214,182,0.06)', border: '1px solid rgba(255,214,182,0.12)', color: 'rgba(255,214,182,0.55)', borderRadius: '6px', padding: '2px 8px' }}>
                      p95 {info.p95.toFixed(0)} ms
                    </span>
                  )}
                  {info.queueLen != null && (
                    <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,214,182,0.06)', border: '1px solid rgba(255,214,182,0.12)', color: 'rgba(255,214,182,0.55)', borderRadius: '6px', padding: '2px 8px' }}>
                      queue: {info.queueLen}
                    </span>
                  )}
                  {info.uptime != null && (
                    <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', background: 'rgba(255,214,182,0.04)', border: '1px solid rgba(255,214,182,0.08)', color: 'rgba(255,214,182,0.4)', borderRadius: '6px', padding: '2px 8px' }}>
                      up {Math.round(info.uptime / 60)}m
                    </span>
                  )}
                  {/* If no stats available at all, show friendly message */}
                  {info.requests == null && info.errors == null && info.p95 == null && (
                    <span style={{ fontSize: '9px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(255,214,182,0.3)', letterSpacing: '0.05em' }}>
                      {hasData ? 'live data  ✓' : 'waiting for metrics…'}
                    </span>
                  )}
                </div>

                {/* Mini spark chart */}
                <div style={{ height: '56px', position: 'relative' }}>
                  {!hasData && (
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.1)', borderRadius: '8px',
                      border: '1px dashed rgba(255,214,182,0.08)',
                    }}>
                      <span style={{ fontSize: '9px', color: 'rgba(255,214,182,0.25)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        📡 awaiting data
                      </span>
                    </div>
                  )}
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                      <XAxis dataKey="time" hide />
                      <YAxis hide domain={[0, 'auto']} />
                      <Tooltip content={<CustomTooltip color={svc.color} />} />
                      {info.latency != null && (
                        <ReferenceLine y={svc.thresholdMs} stroke={`${svc.color}40`} strokeDasharray="3 3" />
                      )}
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={svc.color}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Threshold label */}
                {hasData && (
                  <div style={{ marginTop: '4px', fontSize: '8px', color: `${svc.color}70`, fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', letterSpacing: '0.05em' }}>
                    threshold: {svc.thresholdMs} ms
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
