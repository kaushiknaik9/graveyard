'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Shield, User, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, Zap, Building2, KeyRound } from 'lucide-react';

type Tab = 'citizen' | 'gov';
type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('citizen');
  const [mode, setMode] = useState<Mode>('signin');
  const [govMode, setGovMode] = useState<'signin' | 'register'>('signin');

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [department, setDepartment] = useState('Municipal Highway & Public Works');
  const [passcode, setPasscode] = useState('FORGE-GOV-2026');
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const { signIn, signUp } = useAuth();

  // Set initial tab from redirect query if present
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('redirect')?.startsWith('/gov')) {
        setTab('gov');
      }
    }
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user) {
      const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
      const redirectTarget = params?.get('redirect');
      if (redirectTarget && (role === 'gov' || !redirectTarget.startsWith('/gov'))) {
        router.replace(redirectTarget);
      } else {
        router.replace(role === 'gov' ? '/gov' : '/');
      }
    }
  }, [user, role, loading, router]);

  // 1-Click Demo Official Login Handler
  const handleQuickDemoLogin = async () => {
    setError(null);
    setSuccess(null);
    setDemoLoading(true);

    try {
      // 1. Ensure official demo account exists on server
      const res = await fetch('/api/auth/gov-demo', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize demo official.');
      }

      // 2. Sign in with demo credentials
      const { error: signInErr } = await signIn(data.email, data.password);
      if (signInErr) {
        setError(`Demo sign in failed: ${signInErr}`);
      } else {
        setSuccess('Authorized as Municipal Road Inspector. Redirecting to Command Center...');
        setTimeout(() => {
          router.replace('/gov');
        }, 600);
      }
    } catch (err: any) {
      setError(err?.message || 'Demo official login failed. Please try manual credentials.');
    } finally {
      setDemoLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      if (tab === 'gov' && govMode === 'register') {
        // Register official via dedicated API
        const res = await fetch('/api/auth/register-gov', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            name: name || 'Municipal Official',
            department,
            passcode,
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          setError(json.error || 'Failed to register official account.');
          setSubmitting(false);
          return;
        }

        // Auto sign in after official registration
        const { error: signInErr } = await signIn(email, password);
        if (signInErr) {
          setSuccess('Account created! Please sign in with your password.');
          setGovMode('signin');
        } else {
          setSuccess('Official registered and authorized. Redirecting to Gov Inbox...');
          setTimeout(() => router.replace('/gov'), 600);
        }
        return;
      }

      if (tab === 'citizen' && mode === 'signup') {
        const { error: err } = await signUp(email, password, 'citizen', name || undefined);
        if (err) {
          setError(err);
        } else {
          setSuccess('Account created! You may now sign in.');
          setMode('signin');
        }
      } else {
        // Standard Sign In for citizen or gov
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err);
        } else {
          setSuccess('Signed in successfully. Redirecting...');
        }
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-lime-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#09090b] flex items-center justify-center p-4 sm:p-6">
      {/* Background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-lime-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-lime-400/20">
            <Shield size={24} className="text-black" />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-lime-300 to-emerald-400 bg-clip-text text-transparent">
            Forge Civic
          </h1>
          <p className="text-sm text-zinc-500 mt-1">AI-Powered Road Hazard Reporting</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[#27272a] bg-[#0f0f12]/80 backdrop-blur-xl shadow-2xl shadow-black/40 overflow-hidden">
          {/* Main Tab Selector */}
          <div className="flex border-b border-[#27272a]">
            <button
              onClick={() => { setTab('citizen'); setError(null); setSuccess(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all relative ${
                tab === 'citizen'
                  ? 'text-emerald-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <User size={16} />
              Citizen Reporter
              {tab === 'citizen' && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-lime-400 to-emerald-500 rounded-full" />
              )}
            </button>
            <button
              onClick={() => { setTab('gov'); setError(null); setSuccess(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all relative ${
                tab === 'gov'
                  ? 'text-amber-400'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Shield size={16} />
              Gov Official
              {tab === 'gov' && (
                <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500 rounded-full" />
              )}
            </button>
          </div>

          <div className="p-6">
            {/* ── GOV OFFICIAL SECTION ── */}
            {tab === 'gov' && (
              <div className="space-y-4 mb-5">
                {/* 1-Click Instant Demo Official Access Card */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/30">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-amber-400" />
                        <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                          Municipal Highway Authority
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        One-click access to the incident dispatch command center.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={demoLoading || submitting}
                    onClick={handleQuickDemoLogin}
                    className="w-full mt-2 py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-400/20 active:scale-95 disabled:opacity-60"
                  >
                    {demoLoading ? (
                      <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Zap size={14} className="fill-black" />
                        ⚡ Instant Demo Official Sign-In
                      </>
                    )}
                  </button>
                </div>

                {/* Gov Sub-mode Toggle (Sign In vs Register Official) */}
                <div className="flex gap-1 p-1 bg-[#121218] rounded-lg">
                  <button
                    onClick={() => { setGovMode('signin'); setError(null); setSuccess(null); }}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                      govMode === 'signin'
                        ? 'bg-[#1e1e24] text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Official Sign In
                  </button>
                  <button
                    onClick={() => { setGovMode('register'); setError(null); setSuccess(null); }}
                    className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                      govMode === 'register'
                        ? 'bg-[#1e1e24] text-white shadow-sm'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    Register Official
                  </button>
                </div>
              </div>
            )}

            {/* ── CITIZEN SECTION SUB-MODE TOGGLE ── */}
            {tab === 'citizen' && (
              <div className="flex gap-1 mb-5 p-1 bg-[#121218] rounded-lg">
                <button
                  onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                    mode === 'signin'
                      ? 'bg-[#1e1e24] text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                  className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${
                    mode === 'signup'
                      ? 'bg-[#1e1e24] text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Error / Success Messages */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 animate-fade-in">
                <AlertCircle size={16} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-xs text-red-300">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 animate-fade-in">
                <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-300">{success}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Name field for Citizen Signup OR Gov Register */}
              {((tab === 'citizen' && mode === 'signup') || (tab === 'gov' && govMode === 'register')) && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                    {tab === 'gov' ? 'Official Full Name & Title' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tab === 'gov' ? 'e.g. Officer Ramesh Rao' : 'Your name'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#09090b] border border-[#27272a] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400/30 focus:border-lime-400/40 transition"
                  />
                </div>
              )}

              {/* Department field for Gov Register */}
              {tab === 'gov' && govMode === 'register' && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Building2 size={12} className="text-amber-400" />
                    Government Department
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Municipal PWD / Road Safety Division"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#09090b] border border-[#27272a] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400/40 transition"
                  />
                </div>
              )}

              {/* Email field */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  {tab === 'gov' ? 'Government / Municipal Email' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  placeholder={tab === 'gov' ? 'official@pwd.gov or your email' : 'you@example.com'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#09090b] border border-[#27272a] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400/30 focus:border-lime-400/40 transition"
                />
              </div>

              {/* Password field */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={6}
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-[#09090b] border border-[#27272a] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400/30 focus:border-lime-400/40 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Passcode for Gov Registration */}
              {tab === 'gov' && govMode === 'register' && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound size={12} className="text-amber-400" />
                      Official Passcode
                    </span>
                    <span className="text-[10px] text-amber-400/80 font-mono">FORGE-GOV-2026</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#09090b] border border-[#27272a] text-sm text-amber-300 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/30 transition"
                  />
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting || demoLoading}
                className={`w-full py-3.5 rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 mt-2 ${
                  tab === 'gov'
                    ? 'bg-gradient-to-r from-amber-400 to-orange-500 text-black shadow-lg shadow-amber-400/20 hover:shadow-amber-400/30'
                    : 'bg-gradient-to-r from-lime-400 to-emerald-500 text-black shadow-lg shadow-lime-400/20 hover:shadow-lime-400/30'
                } ${submitting ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'}`}
              >
                {submitting ? (
                  <div className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                ) : (
                  <>
                    {tab === 'gov'
                      ? govMode === 'register'
                        ? 'Register Official Credentials'
                        : 'Sign In to Official Command Center'
                      : mode === 'signup'
                      ? 'Create Citizen Account'
                      : 'Sign In as Citizen'}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-zinc-600 mt-6">
          Civic road safety infrastructure • Powered by Gemini AI & Supabase
        </p>
      </div>
    </main>
  );
}
