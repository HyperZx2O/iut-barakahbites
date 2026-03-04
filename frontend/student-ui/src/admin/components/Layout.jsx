import { useAdminAuth } from '../context/AdminAuthContext';
import RamadanBadge from './RamadanBadge';

export default function Layout({ children }) {
  const { logout } = useAdminAuth();

  /* Neomorphic extruded logout button — same anatomy as ChaosBtn */
  const bsRest = '8px 8px 20px rgba(0,0,0,0.5), -5px -5px 14px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,214,182,0.05), inset 0 -1px 0 rgba(0,0,0,0.15)';
  const bsHover = '10px 10px 26px rgba(0,0,0,0.5), -6px -6px 18px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,214,182,0.07), 0 0 18px rgba(234,115,98,0.2)';
  const bsDown = 'inset 6px 6px 16px rgba(0,0,0,0.45), inset -4px -4px 12px rgba(183,66,66,0.05), 0 0 10px rgba(234,115,98,0.1)';

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-[#FFD6B6] selection:bg-[#EA7362]/30">
      {/* Header: 3-column grid so title is ALWAYS centered and logout is ALWAYS top-right */}
      <header
        className="neomorph-card m-4 rounded-2xl z-10"
        style={{ height: '64px', display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 20px' }}
      >
        {/* ── Top-left: Ramadan Mubarak Badge ── */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <RamadanBadge />
        </div>

        {/* Center: IUT BarakahBites — typography matches student-ui exactly */}
        <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'baseline', gap: '10px', justifyContent: 'center' }}>
          <h1 style={{
            textAlign: 'center',
            fontSize: '1.5rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#FFD6B6',
            whiteSpace: 'nowrap',
            fontFamily: "'DM Sans', system-ui, sans-serif",
            textShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}>
            IUT{' '}
            <span style={{
              color: '#EA7362',
              textShadow: '0 0 18px rgba(234,115,98,0.55), 0 2px 8px rgba(0,0,0,0.4)',
            }}>
              BarakahBites
            </span>
          </h1>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            textTransform: 'uppercase',
            letterSpacing: '0.2em',
            color: '#FFD6B6',
            opacity: 0.5,
            padding: '2px 8px',
            borderLeft: '1px solid rgba(255,214,182,0.1)',
            marginLeft: '4px'
          }}>
            Admin
          </span>
        </div>

        {/* Right: Logout button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={logout}
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: '10px',
              textTransform: 'uppercase',
              letterSpacing: '0.09em',
              color: '#FFD6B6',
              background: 'transparent',
              border: '1.5px solid rgba(234, 115, 98, 0.4)',
              borderRadius: '10px',
              padding: '7px 18px',
              cursor: 'pointer',
              textShadow: '0 0 8px rgba(234,115,98,0.55), 0 2px 4px rgba(0,0,0,0.7)',
              boxShadow: bsRest,
              transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(234,115,98,0.65)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = bsHover;
              e.currentTarget.style.textShadow = '0 0 12px rgba(234,115,98,0.8), 0 2px 4px rgba(0,0,0,0.8)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(234,115,98,0.4)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = bsRest;
              e.currentTarget.style.textShadow = '0 0 8px rgba(234,115,98,0.55), 0 2px 4px rgba(0,0,0,0.7)';
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
            LOGOUT
          </button>
        </div>
      </header>

      <main style={{ flex: 1 }}>{children}</main>

      <footer style={{ padding: '20px 0', textAlign: 'center', fontSize: '11px', color: '#FFD6B6', borderTop: '1px solid rgba(255,214,182,0.05)', fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        © 2026 IUT BarakahBites • Team PoweredByPatience
      </footer>
    </div>
  );
}
