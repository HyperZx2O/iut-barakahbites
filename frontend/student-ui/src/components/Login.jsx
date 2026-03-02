import { useState } from 'react';
import { identityApi } from '../api';
import { useAuth } from '../context/AuthContext';

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

      <div className="w-full flex flex-col gap-6 mb-20">
        <div className="space-y-3 w-full">
          <label className="text-xs font-bold text-[#FFD6B6] uppercase tracking-widest ml-2 block">Student ID</label>
          <input
            type="text"
            placeholder="STU_ID_XXXX"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            required
            style={{ color: "white", boxSizing: "border-box" }}
            className="neomorph-inset w-full px-6 py-4 rounded-2xl text-[#FFD6B6] placeholder:text-[#FFD6B6]0 font-mono text-sm transition-all focus:ring-2 focus:ring-indigo-500/50 caret-indigo-400 outline-none"
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
            className="neomorph-inset w-full px-6 py-4 rounded-2xl text-[#FFD6B6] placeholder:text-[#FFD6B6]0 font-mono text-sm transition-all focus:ring-2 focus:ring-indigo-500/50 caret-indigo-400 outline-none"
          />
        </div>
      </div>

      <div className="w-full mt-4">
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 rounded-2xl text-sm font-bold uppercase tracking-widest text-[#FFD6B6] transition-all duration-300 active:scale-[0.98] outline-none"
        >
          <span className="relative z-10">
            {loading ? 'Signing in…' : 'Sign In →'}
          </span>
        </button>

        <div className="mt-8 text-center">
          <p className="text-[9px] text-[#FFD6B6]/60 uppercase tracking-[0.4em] font-mono leading-none">
            IUT BarakahBites • <span className="text-emerald-500/70">Operational</span>
          </p>
        </div>
      </div>
    </form>
  );
}
