import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { generateReceipt } from '../utils/pdfGenerator';

const READY_TTL = 5 * 60 * 1000;  // 5 min
const NON_READY_TTL = 3 * 60 * 1000;  // 3 min

const STATUS_ORDER = ['PENDING', 'STOCK_VERIFIED', 'IN_KITCHEN', 'READY'];

const LABELS = {
  PENDING: 'Order Received',
  STOCK_VERIFIED: 'Items Reserved',
  IN_KITCHEN: 'Preparing in Kitchen',
  READY: 'Order Ready for Pickup',
};

const COLORS = {
  PENDING: { dot: '#EA7362', text: '#FFD6B6', bar: '#EA7362' },
  STOCK_VERIFIED: { dot: '#38bdf8', text: '#bae6fd', bar: '#0ea5e9' },
  IN_KITCHEN: { dot: '#fb923c', text: '#fed7aa', bar: '#f97316' },
  READY: { dot: '#EA7362', text: '#6ee7b7', bar: '#EA7362' },
};

const RamadanEmptyState = () => (
  <div style={{
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '24px',
    textAlign: 'center',
    padding: '24px',
    animation: 'fadeIn 0.8s ease-out forwards',
  }}>
    <div style={{
      position: 'relative',
      width: '160px',
      height: '160px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Background Glow */}
      <div
        className="ramadan-pulse-div"
        style={{
          position: 'absolute',
          width: '120px',
          height: '120px',
          background: 'radial-gradient(circle, rgba(234, 115, 98, 0.25) 0%, transparent 70%)',
          borderRadius: '50%',
        }}
      />

      <svg width="140" height="140" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ zIndex: 1 }}>
        {/* Twinkling Stars */}
        <circle cx="15" cy="20" r="1.5" fill="#FFD6B6" style={{ animation: 'starTwinkle 2.5s infinite ease-in-out' }} />
        <circle cx="85" cy="25" r="1.2" fill="#FFD6B6" style={{ animation: 'starTwinkle 3s infinite ease-in-out', animationDelay: '0.6s' }} />
        <circle cx="75" cy="70" r="1" fill="#FFD6B6" style={{ animation: 'starTwinkle 2s infinite ease-in-out', animationDelay: '1.2s' }} />
        <circle cx="25" cy="80" r="0.8" fill="#FFD6B6" style={{ animation: 'starTwinkle 3.5s infinite ease-in-out', animationDelay: '0.3s' }} />

        {/* Crescent Moon */}
        <path
          d="M65 25C65 44.33 49.33 60 30 60C25.15 60 20.55 59.02 16.36 57.25C22.61 64.91 32.2 69.75 42.92 69.75C60.2 69.75 74.21 55.74 74.21 38.46C74.21 28.53 69.59 19.67 62.43 13.92C64.06 17.39 65 21.09 65 25Z"
          fill="url(#moonGrad)"
          style={{ filter: 'drop-shadow(0 0 10px rgba(255, 214, 182, 0.25))' }}
        />

        {/* Ornate Lantern (Fanous) */}
        <g style={{ filter: 'drop-shadow(0 0 12px rgba(234, 115, 98, 0.35))' }}>
          {/* Top of lantern */}
          <path d="M50 35C50 35 48 32 48 30C48 28 50 27 50 27C50 27 52 28 52 30C52 32 50 35 50 35Z" stroke="#EA7362" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M42 42C42 42 45 38 50 38C55 38 58 42 58 42" stroke="#EA7362" strokeWidth="2" strokeLinecap="round" />

          {/* Body */}
          <path d="M42 42L58 42L62 55L58 78L42 78L38 55L42 42Z" fill="rgba(234, 115, 98, 0.08)" stroke="#EA7362" strokeWidth="2.2" strokeLinejoin="round" />

          {/* Internal Glow */}
          <circle cx="50" cy="58" r="7" fill="#EA7362">
            <animate attributeName="opacity" values="0.4;0.7;0.4" dur="2.5s" repeatCount="indefinite" />
            <animate attributeName="r" values="6.5;8;6.5" dur="2.5s" repeatCount="indefinite" />
          </circle>

          {/* Bottom */}
          <path d="M42 78C42 78 45 83 50 83C55 83 58 78 58 78" stroke="#EA7362" strokeWidth="2.2" strokeLinecap="round" />

          {/* Ribs */}
          <path d="M47 42L47 78M53 42L53 78" stroke="#EA7362" strokeWidth="0.8" opacity="0.5" />
        </g>

        <defs>
          <linearGradient id="moonGrad" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FFD6B6" />
            <stop offset="100%" stopColor="#EA7362" />
          </linearGradient>
        </defs>
      </svg>
    </div>

    <div style={{ zIndex: 1 }}>
      <h3 style={{
        color: '#FFD6B6',
        fontSize: '1.2rem',
        fontWeight: 700,
        marginBottom: '8px',
        letterSpacing: '-0.01em',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        No active orders
      </h3>
      <p style={{
        color: '#FFD6B6',
        fontSize: '0.9rem',
        opacity: 0.7,
        lineHeight: '1.5',
        maxWidth: '220px',
        margin: '0 auto',
        fontStyle: 'italic',
        fontFamily: "'Montserrat', sans-serif",
      }}>
        Your Iftar box is waiting to be ordered 🌙
      </p>
    </div>
  </div>
);

/* Shared fixed dimensions — must match OrderForm */
const BOX_W = '460px';
const BOX_H = '460px'; // fixed, never grows

export default function StatusTracker() {
  const { user } = useAuth();
  // Map: orderId → { orderId, itemName, quantity, events: [{status, timestamp}] }
  const [orders, setOrders] = useState({});
  const esRef = useRef(null);
  const timersRef = useRef({});

  const getStatusWeight = (s) => STATUS_ORDER.indexOf(s) + 1;

  /* 12-hour time format */
  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch { return iso; }
  };

  const scheduleRemoval = (orderId, ttl) => {
    if (timersRef.current[orderId]) clearTimeout(timersRef.current[orderId]);
    timersRef.current[orderId] = setTimeout(() => {
      setOrders(prev => {
        const next = { ...prev };
        delete next[orderId];
        return next;
      });
    }, ttl);
  };

  const connect = () => {
    if (!user?.studentId) return;
    const baseUrl = import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:3005';
    const url = `${baseUrl}/events/${user.studentId}`;
    console.log(`[SSE] Connecting to ${url}...`);
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => console.log('[SSE] Connection opened');

    es.onmessage = (e) => {
      console.log('[SSE] Message received:', e.data);
      const payload = JSON.parse(e.data);
      const { orderId, status, timestamp, items, itemName, itemId, quantity, metadata } = payload;

      setOrders(prev => {
        const existing = prev[orderId] || {
          orderId,
          items: items || (itemName || itemId ? [{ itemName: itemName || itemId || `Order ${orderId?.slice(-6) ?? ''}`, quantity: quantity ?? null }] : []),
          events: [],
        };

        // Keep item metadata from first event (won't change per order)
        const resolvedItems = (items && items.length > 0) ? items : existing.items;

        // Skip duplicate statuses
        if (existing.events.some(ev => ev.status === status)) return prev;

        return {
          ...prev,
          [orderId]: {
            orderId,
            items: resolvedItems,
            metadata: metadata || existing.metadata || {},
            events: [...existing.events, { status, timestamp }]
              .sort((a, b) => getStatusWeight(a.status) - getStatusWeight(b.status)),
          },
        };
      });

      const ttl = status === 'READY' ? READY_TTL : NON_READY_TTL;
      scheduleRemoval(orderId, ttl);
    };

    es.onerror = (err) => {
      console.error('[SSE] Connection error:', err);
      es.close();
      setTimeout(() => { console.log('[SSE] Retrying...'); connect(); }, 3000);
    };
  };

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      Object.values(timersRef.current).forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.studentId]);

  const orderList = Object.values(orders);

  return (
    <section
      className="neomorph-card enter"
      style={{
        width: BOX_W,
        height: BOX_H,
        maxWidth: '100%',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        /* Hard cap — never grows beyond BOX_H */
        overflow: 'hidden',
      }}
    >
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', flexShrink: 0 }}>
        <span style={{ width: '3px', height: '22px', background: '#EA7362', borderRadius: '9999px', display: 'block' }} />
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: '#FFD6B6',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          textShadow: '0 2px 8px rgba(0,0,0,0.3)',
        }}>
          Order Status
        </h2>
      </div>

      {/* Empty state */}
      {orderList.length === 0 && <RamadanEmptyState />}

      {/* Scrollable order cards — this area grows/shrinks, outer box never does */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        /* subtle scrollbar */
        scrollbarWidth: 'thin',
        scrollbarColor: 'rgba(234, 115, 98, 0.3) transparent',
      }}>
        {orderList.map(({ orderId, items, events, metadata }) => {
          const latestStatus = events[events.length - 1]?.status;
          const weight = getStatusWeight(latestStatus);
          const c = COLORS[latestStatus] || COLORS.PENDING;
          const isReady = latestStatus === 'READY';

          let orderLabel = `Order ${orderId?.slice(-6) ?? '...'}`;
          if (items && items.length > 0) {
            orderLabel = items.map(it => {
              const name = it.itemName || it.itemId || 'Item';
              return it.quantity != null ? `${name} ×${it.quantity}` : name;
            }).join(', ');
          }

          return (
            <div
              key={orderId}
              className="status-card-enter"
              style={{
                borderRadius: '14px',
                overflow: 'hidden',
                background: 'linear-gradient(145deg, rgba(140, 50, 50, 0.85) 0%, rgba(100, 35, 35, 0.8) 100%)',
                border: `1px solid ${c.dot}30`,
                boxShadow: `6px 6px 18px rgba(0,0,0,0.5), 0 0 14px ${c.dot}18`,
                flexShrink: 0,
              }}
            >
              {/* Top progress bar */}
              <div style={{
                height: '3px',
                background: `linear-gradient(90deg, ${c.bar} 0%, ${c.bar}80 100%)`,
                width: `${(weight / 4) * 100}%`,
                transition: 'width 0.8s ease',
              }} />

              <div style={{ padding: '10px 14px 12px' }}>
                {/* ── Order header: item name + qty ── */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}>
                  <span style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: c.text,
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    letterSpacing: '0.02em',
                  }}>
                    {orderLabel}
                  </span>
                  <span style={{
                    fontSize: '9px',
                    color: '#FFD6B6',
                    fontFamily: 'JetBrains Mono, monospace',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '2px 7px',
                    borderRadius: '5px',
                  }}>
                    #{orderId?.slice(-6).toUpperCase() ?? '—'}
                  </span>
                </div>

                {/* Divider */}
                <div style={{ height: '1px', background: 'rgba(255,214,182,0.05)', marginBottom: '10px' }} />

                {/* Status steps */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {STATUS_ORDER.map((s) => {
                    const ev = events.find(e => e.status === s);
                    const received = !!ev;
                    const isLatest = s === latestStatus;
                    const sc = COLORS[s];
                    return (
                      <div
                        key={s}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '7px',
                          background: received ? (isLatest ? `${sc.dot}14` : 'rgba(255, 214, 182, 0.02)') : 'transparent',
                          border: received ? (isLatest ? `1px solid ${sc.dot}35` : '1px solid rgba(255, 214, 182, 0.04)') : '1px solid transparent',
                          transition: 'all 0.4s ease',
                          opacity: received ? 1 : 0.25,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{
                            width: '6px', height: '6px', borderRadius: '50%',
                            background: received ? sc.dot : '#334155',
                            boxShadow: received && isLatest ? `0 0 5px ${sc.dot}` : 'none',
                            flexShrink: 0,
                            transition: 'all 0.4s ease',
                          }} />
                          <span style={{
                            fontSize: '11px',
                            fontWeight: isLatest ? 700 : 500,
                            color: received ? (isLatest ? sc.text : '#FFD6B6') : '#334155',
                          }}>
                            {LABELS[s]}
                          </span>
                        </div>
                        {received && (
                          <span style={{
                            fontSize: '9px',
                            color: '#FFD6B6',
                            fontFamily: 'JetBrains Mono, monospace',
                            background: 'rgba(0,0,0,0.3)',
                            padding: '1px 5px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                          }}>
                            {formatTime(ev.timestamp)}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Generate Receipt button (READY only) ── */}
              {isReady && (
                <div style={{ padding: '0 14px 12px' }}>
                  <button
                    type="button"
                    className="button-press-effect"
                    onClick={() => generateReceipt({
                      orderId,
                      items,
                      metadata,
                      studentId: user?.studentId,
                      events,
                    })}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '9px 0',
                      border: 'none',
                      borderRadius: '10px',
                      background: 'linear-gradient(145deg, #EA7362 0%, #B04A3C 100%)',
                      boxShadow: '4px 4px 10px rgba(0,0,0,0.3), inset 1px 1px 2px rgba(255,255,255,0.2)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      letterSpacing: '0.02em',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.filter = 'brightness(1.08)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.filter = 'brightness(1)';
                    }}
                  >
                    {/* FileText icon (inline SVG) */}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    Generate Receipt
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
