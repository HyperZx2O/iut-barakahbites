import { useState } from 'react';
import { useAdminAuth } from '../context/AdminAuthContext';
import api from '../api';

export default function AdminLoginPage() {
    const { login } = useAdminAuth();
    const [adminId, setAdminId] = useState('');
    const [pwd, setPwd] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            const identityUrl = import.meta.env.VITE_IDENTITY_URL || 'http://localhost:3001';
            const resp = await api.post(`${identityUrl}/auth/login`, { studentId: adminId, password: pwd });
            login(resp.data.token);
        } catch (err) {
            setError(err.response?.data?.msg ?? 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen selection:bg-[#EA7362]/30">
            <div className="center-fixed px-6">
                <form
                    onSubmit={submit}
                    className="neomorph-login rounded-[2.5rem] w-full max-w-[460px] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-700 mx-auto"
                >
                    <div className="text-center space-y-4 w-full mb-10">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-[#EA7362]/10 border border-[#EA7362]/20 mb-4 shadow-inner">
                            <svg className="w-8 h-8 text-[#FFD6B6]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h2 className="text-4xl font-bold tracking-wider text-[#FFD6B6]">
                            Admin <span className="text-[#FFD6B6] block mt-1">Dashboard</span>
                        </h2>
                        <div className="flex items-center justify-center gap-4 mt-4">
                            <span className="h-px w-12 bg-gradient-to-r from-transparent to-[#EA7362]/30"></span>
                            <span className="h-px w-12 bg-gradient-to-l from-transparent to-[#EA7362]/30"></span>
                        </div>
                    </div>

                    {error && (
                        <div className="w-full p-4 mb-8 rounded-2xl neomorph-inset text-[#B74242] text-xs font-bold text-center uppercase tracking-widest border border-[#B74242]/10">
                            SYSTEM ERROR: {error}
                        </div>
                    )}

                    <div className="w-full flex flex-col gap-6 mb-20">
                        <div className="space-y-3 w-full">
                            <label className="text-xs font-bold text-[#FFD6B6] uppercase tracking-widest ml-2 block">Admin ID</label>
                            <input
                                type="text"
                                placeholder="STU_ID_XXXX"
                                value={adminId}
                                onChange={(e) => setAdminId(e.target.value)}
                                required
                                style={{ color: "white", boxSizing: "border-box" }}
                                className="neomorph-inset w-full px-6 py-4 rounded-2xl text-[#FFD6B6] placeholder:text-[#FFD6B6]/60 font-mono text-sm transition-all focus:ring-2 focus:ring-[#EA7362]/50 caret-[#EA7362] outline-none"
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
                                className="neomorph-inset w-full px-6 py-4 rounded-2xl text-[#FFD6B6] placeholder:text-[#FFD6B6]/60 font-mono text-sm transition-all focus:ring-2 focus:ring-[#EA7362]/50 caret-[#EA7362] outline-none"
                            />
                        </div>
                    </div>

                    <div className="w-full">
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
                                Authorized Personnel Only • <span className="text-[#EA7362]/70">Active</span>
                            </p>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
