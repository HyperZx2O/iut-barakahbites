import React from 'react';

/**
 * RamadanBadge Component
 * A premium, neomorphic Ramadan crescent and star badge.
 * Features:
 * - Pulse glow animation
 * - Twinkling star
 * - Dual language (Arabic/English) typography
 * - Fits with the deep burgundy / mahagony theme
 */
const RamadanBadge = () => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* ── Crescent & Star SVG ── */}
            <div style={{ position: 'relative', width: '38px', height: '38px' }}>
                <svg
                    width="38" height="38" viewBox="0 0 38 38"
                    fill="none" xmlns="http://www.w3.org/2000/svg"
                    style={{
                        animation: 'ramadanGlow 3s ease-in-out infinite',
                        filter: 'drop-shadow(0 0 4px rgba(234, 115, 98, 0.3))'
                    }}
                    aria-label="Ramadan Crescent moon"
                >
                    {/* Subtle Outer Glow Ring */}
                    <circle cx="17" cy="19" r="15" stroke="#EA7362" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.4" />

                    {/* The Crescent Moon */}
                    <path
                        d="M17 5C24.732 5 31 11.268 31 19C31 26.732 24.732 33 17 33C9.268 33 3 26.732 3 19C3 11.268 9.268 5 17 5ZM17 9C11.477 9 7 13.477 7 19C7 24.523 11.477 29 17 29C22.523 29 27 24.523 27 19C27 16.784 26.279 14.736 25.07 13.064C26.279 11.392 27 9.344 27 7.128C27 6.024 26.83 4.962 26.516 3.961C26.046 5.8 24.966 7.428 23.468 8.618C21.652 10.062 19.418 10.928 17 10.928C17 10.285 17 9.643 17 9Z"
                        fill="#EA7362"
                        opacity="0.95"
                    />

                    {/* Bite out the crescent using a mask-like circle if path above is complex, 
              but the path above actually attempts to draw a crescent. 
              Let's use a simpler "Circle minus Circle" for clarity. */}
                    <circle cx="15" cy="19" r="13" fill="#EA7362" />
                    <circle cx="21" cy="15" r="11" fill="#461919" /> {/* Dark bg-like color to carve out */}

                    {/* Star with twinkle */}
                    <path
                        d="M27 8L28.2 10.5L31 10.5L28.8 12.2L29.6 15L27 13.3L24.4 15L25.2 12.2L23 10.5L25.8 10.5L27 8Z"
                        fill="#FFD6B6"
                        style={{
                            transformOrigin: '27px 11.5px',
                            animation: 'starTwinkle 2.5s ease-in-out infinite'
                        }}
                    />
                </svg>
            </div>

            {/* ── Text Labels (hidden on small mobile) ── */}
            <style>{`
        @media (max-width: 450px) {
          .ramadan-text { display: none !important; }
        }
      `}</style>
            <div className="ramadan-text" style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#EA7362',
                    letterSpacing: '0.1em',
                    textShadow: '0 0 10px rgba(234,115,98,0.4)',
                    fontFamily: "'DM Sans', sans-serif"
                }}>
                    رمضان مبارك
                </span>
                <span style={{
                    fontSize: '9px',
                    fontWeight: 600,
                    color: '#FFD6B6',
                    opacity: 0.8,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    fontFamily: "'JetBrains Mono', monospace"
                }}>
                    Ramadan Mubarak
                </span>
            </div>
        </div>
    );
};

export default RamadanBadge;
