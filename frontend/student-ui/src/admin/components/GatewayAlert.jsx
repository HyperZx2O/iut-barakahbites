import { useEffect, useState } from 'react';

/**
 * GatewayAlert
 * ─────────────────────────────────────────────────────────────
 * Renders a fixed-position overlay banner when the Order Gateway's
 * 30-second windowed average latency exceeds 1 000 ms.
 *
 * Props:
 *   isActive  {boolean}  — whether the alert condition is met
 *   latencyMs {number}   — the current windowed average (ms)
 *   onDismiss {function} — called when the user manually dismisses
 */
export default function GatewayAlert({ isActive, latencyMs, onDismiss }) {
    // Separate "visible" state so we can animate out before unmounting
    const [visible, setVisible] = useState(false);
    const [animating, setAnimating] = useState(false);

    useEffect(() => {
        if (isActive) {
            setVisible(true);
            setAnimating(false);
        } else if (visible) {
            // Slide out before hiding
            setAnimating(true);
            const t = setTimeout(() => {
                setVisible(false);
                setAnimating(false);
            }, 400);
            return () => clearTimeout(t);
        }
    }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

    if (!visible) return null;

    const slideIn = {
        animation: animating
            ? 'gatewayAlertSlideOut 0.4s cubic-bezier(0.4,0,1,1) forwards'
            : 'gatewayAlertSlideIn 0.35s cubic-bezier(0,0,0.2,1) forwards',
    };

    const seconds = latencyMs != null ? (latencyMs / 1000).toFixed(2) : '—';

    return (
        <>
            {/* Keyframes injected once */}
            <style>{`
        @keyframes gatewayAlertSlideIn {
          from { transform: translateY(-110%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes gatewayAlertSlideOut {
          from { transform: translateY(0);    opacity: 1; }
          to   { transform: translateY(-110%); opacity: 0; }
        }
        @keyframes gatewayAlertPulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.55), 0 4px 24px rgba(0,0,0,0.6); }
          50%      { box-shadow: 0 0 22px 6px rgba(239,68,68,0.25), 0 4px 24px rgba(0,0,0,0.6); }
        }
      `}</style>

            <div
                role="alert"
                aria-live="assertive"
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 9999,
                    ...slideIn,
                    animation: `${animating ? 'gatewayAlertSlideOut' : 'gatewayAlertSlideIn'} 0.35s cubic-bezier(0,0,0.2,1) forwards, gatewayAlertPulse 2.4s ease-in-out ${animating ? '0s' : '0.35s'} infinite`,
                    background: 'linear-gradient(90deg, rgba(127,29,29,0.97) 0%, rgba(185,28,28,0.95) 50%, rgba(127,29,29,0.97) 100%)',
                    borderBottom: '1.5px solid rgba(239,68,68,0.45)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 24px',
                    gap: '16px',
                }}
            >
                {/* Left: Icon + message */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {/* Pulsing dot */}
                    <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: '#f87171',
                        flexShrink: 0,
                        boxShadow: '0 0 0 0 rgba(248,113,113,0.7)',
                        animation: 'gatewayAlertPulse 1.2s ease-out infinite',
                    }} />

                    <span style={{
                        fontFamily: "'DM Sans', system-ui, sans-serif",
                        fontWeight: 700,
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.12em',
                        color: '#fca5a5',
                    }}>
                        ⚠ Latency Critical
                    </span>

                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        color: 'rgba(252,165,165,0.75)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        Order Gateway avg response is <strong style={{ color: '#fca5a5' }}>{seconds}s</strong> over 30s window — threshold: 1.00s
                    </span>
                </div>

                {/* Right: Dismiss button */}
                <button
                    onClick={onDismiss}
                    aria-label="Dismiss latency alert"
                    style={{
                        flexShrink: 0,
                        background: 'transparent',
                        border: '1px solid rgba(252,165,165,0.35)',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        color: 'rgba(252,165,165,0.8)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontWeight: 700,
                        fontSize: '9px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(239,68,68,0.2)';
                        e.currentTarget.style.borderColor = 'rgba(252,165,165,0.6)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'rgba(252,165,165,0.35)';
                    }}
                >
                    Dismiss
                </button>
            </div>
        </>
    );
}
