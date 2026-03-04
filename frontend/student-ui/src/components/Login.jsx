import { useState } from 'react';
import { identityApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Login() {
  const { login } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [pwd, setPwd] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const resp = await identityApi.post('/auth/login', { studentId, password: pwd });
      login(resp.data.token, { studentId: resp.data.studentId });
    } catch (err) {
      setError(err.response?.data?.error ?? err.response?.data?.msg ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  /* ── Shared nav-button style factory ── */
  const bsRest = '6px 6px 16px rgba(0,0,0,0.35), -3px -3px 10px rgba(183,66,66,0.06), inset 0 1px 0 rgba(255,214,182,0.04)';
  const bsHover = '8px 8px 22px rgba(0,0,0,0.45), -4px -4px 14px rgba(183,66,66,0.08), inset 0 1px 0 rgba(255,214,182,0.06), 0 0 20px rgba(183,66,66,0.12)';
  const bsDown = 'inset 4px 4px 12px rgba(0,0,0,0.35), inset -2px -2px 8px rgba(183,66,66,0.05)';

  return (
    <form
      onSubmit={submit}
      className="neomorph-login rounded-[2.5rem] w-full max-w-[460px] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700 mx-auto"
    >
      <div className="text-center space-y-4 w-full mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 mb-4 shadow-inner">
          <svg className="w-8 h-8 text-[#FFD6B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <h2 className="text-4xl font-bold tracking-wider text-[#FFD6B6]">
          Student <span className="text-[#FFD6B6] block mt-1">Portal</span>
        </h2>
        <div className="flex items-center justify-center gap-4 mt-4">
          <span className="h-px w-12 bg-gradient-to-r from-transparent to-indigo-500/30"></span>
          <span className="h-px w-12 bg-gradient-to-l from-transparent to-indigo-500/30"></span>
        </div>
      </div>

      {error && (
        <div className="w-full p-4 mb-8 rounded-2xl neomorph-inset text-[#B74242] text-xs font-bold text-center uppercase tracking-widest border border-rose-500/10">
          SYSTEM ERROR: {error}
        </div>
      )}

      <div className="w-full flex flex-col gap-6 mb-8">
        <div className="space-y-3 w-full">
          <label className="text-xs font-bold text-[#FFD6B6] uppercase tracking-widest ml-2 block">Student ID</label>
          <input
            type="text"
            placeholder="STU_ID_XXXX"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            style={{ color: "white", boxSizing: "border-box" }}
            className="neomorph-inset w-full px-6 py-4 rounded-2xl text-[#FFD6B6] placeholder:text-[#FFD6B6]/40 font-mono text-sm transition-all focus:ring-2 focus:ring-indigo-500/50 caret-indigo-400 outline-none"
          />
        </div>
        <div className="space-y-3 w-full">
          <label className="text-xs font-bold text-[#FFD6B6] uppercase tracking-widest ml-2 block">Password</label>
          <input
            type="password"
            placeholder="••••••••"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            required
            style={{ color: "white", boxSizing: "border-box" }}
            className="neomorph-inset w-full px-6 py-4 rounded-2xl text-[#FFD6B6] placeholder:text-[#FFD6B6]/40 font-mono text-sm transition-all focus:ring-2 focus:ring-indigo-500/50 caret-indigo-400 outline-none"
          />
        </div>
      </div>

      <div className="w-full flex flex-col gap-4">
        {/* ── Sign In button ── */}
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: '12px',
            width: '100%',
            padding: '14px',
            borderRadius: '14px',
            border: '1.5px solid rgba(234,115,98,0.3)',
            background: 'linear-gradient(145deg, rgba(183,66,66,0.5) 0%, rgba(130,32,32,0.45) 100%)',
            boxShadow: '6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(183,66,66,0.06), inset 0 1px 0 rgba(255,214,182,0.07)',
            color: '#FFD6B6',
            fontSize: '11px',
            fontWeight: 700,
            fontFamily: "'DM Sans', sans-serif",
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.22s cubic-bezier(0.4,0,0.2,1)',
            opacity: loading ? 0.65 : 1,
          }}
          onMouseEnter={e => {
            if (loading) return;
            e.currentTarget.style.borderColor = 'rgba(234,115,98,0.55)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '8px 8px 22px rgba(0,0,0,0.5), -4px -4px 12px rgba(183,66,66,0.07), inset 0 1px 0 rgba(255,214,182,0.1), 0 0 20px rgba(234,115,98,0.15)';
            e.currentTarget.style.background = 'linear-gradient(145deg, rgba(210,75,75,0.65) 0%, rgba(155,40,40,0.6) 100%)';
          }}
          onMouseLeave={e => {
            if (loading) return;
            e.currentTarget.style.borderColor = 'rgba(234,115,98,0.3)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '6px 6px 16px rgba(0,0,0,0.45), -3px -3px 10px rgba(183,66,66,0.06), inset 0 1px 0 rgba(255,214,182,0.07)';
            e.currentTarget.style.background = 'linear-gradient(145deg, rgba(183,66,66,0.5) 0%, rgba(130,32,32,0.45) 100%)';
          }}
          onMouseDown={e => {
            if (loading) return;
            e.currentTarget.style.transform = 'translateY(1px)';
            e.currentTarget.style.boxShadow = 'inset 5px 5px 14px rgba(0,0,0,0.4), inset -3px -3px 10px rgba(183,66,66,0.05)';
          }}
          onMouseUp={e => {
            if (loading) return;
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
        >
          {loading ? 'Signing in…' : 'Sign In →'}
        </button>

        {/* ── Footer ── */}
        <div className="text-center mt-2">
          <p className="text-[9px] text-[#FFD6B6]/60 uppercase tracking-[0.4em] font-mono leading-none">
            IUT BarakahBites • <span className="text-emerald-500/70">Operational</span>
          </p>
        </div>

        {/* ── Admin portal link ── */}
        <Link
          to="/admin/login"
          style={{ display: 'block', textDecoration: 'none' }}
        >
          <button
            type="button"
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '14px',
              border: '1.5px solid rgba(183,66,66,0.25)',
              background: 'linear-gradient(145deg, rgba(140,50,50,0.35) 0%, rgba(100,35,35,0.28) 100%)',
              boxShadow: bsRest,
              color: '#FFD6B6',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(183,66,66,0.5)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = bsHover;
              e.currentTarget.style.background = 'linear-gradient(145deg, rgba(140,50,50,0.5) 0%, rgba(100,35,35,0.42) 100%)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(183,66,66,0.25)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = bsRest;
              e.currentTarget.style.background = 'linear-gradient(145deg, rgba(140,50,50,0.35) 0%, rgba(100,35,35,0.28) 100%)';
            }}
            onMouseDown={e => {
              e.currentTarget.style.transform = 'translateY(1px)';
              e.currentTarget.style.boxShadow = bsDown;
            }}
            onMouseUp={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
              <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Go to Admin Portal →
          </button>
        </Link>
      </div>
    </form>
  );
}
