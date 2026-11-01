'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import {
  Shield,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Zap,
  Building2,
  KeyRound,
  Radio,
} from 'lucide-react';

type Tab = 'citizen' | 'gov';
type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const { user, role, loading, signIn, signUp } = useAuth();
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('redirect')?.startsWith('/gov')) {
        setTab('gov');
      }
    }
  }, []);

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

  const handleQuickDemoLogin = async () => {
    setError(null);
    setSuccess(null);
    setDemoLoading(true);

    try {
      const res = await fetch('/api/auth/gov-demo', {
        method: 'POST',
        headers: { 'x-forge-client': 'forge-next-frontend-v1' },
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize demo official.');
      }

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
      setError(err?.message || 'Demo official login failed.');
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
        const res = await fetch('/api/auth/register-gov', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forge-client': 'forge-next-frontend-v1',
          },
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
        const { error: err } = await signIn(email, password);
        if (err) {
          setError(err);
        } else {
          setSuccess('Signed in successfully. Redirecting...');
          const target = tab === 'gov' ? '/gov' : '/';
          setTimeout(() => router.replace(target), 400);
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
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-canvas)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#F7D10C] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[var(--bg-canvas)] flex items-center justify-center p-4 sm:p-6 transition-colors">
      <div className="w-full max-w-md animate-fade-in space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl overflow-hidden mx-auto bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center p-1 shadow-sm">
            <img src="/Logo.png" alt="Forge Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
            FORGE ACCESS TERMINAL
          </h1>
          <p className="font-mono text-xs text-[var(--text-secondary)]">
            Autonomous Road Hazard Telemetry & Municipal Incident Dispatch
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg overflow-hidden">
          {/* Main Tab Selector */}
          <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1 gap-1">
            <button
              type="button"
              onClick={() => { setTab('citizen'); setError(null); setSuccess(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                tab === 'citizen'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <User size={14} />
              <span>CITIZEN</span>
            </button>
            <button
              type="button"
              onClick={() => { setTab('gov'); setError(null); setSuccess(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                tab === 'gov'
                  ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Shield size={14} className="text-[#F7D10C]" />
              <span>OFFICIAL</span>
            </button>
          </div>

          <div className="p-6">
            {/* GOV OFFICIAL SECTION */}
            {tab === 'gov' && (
              <div className="space-y-4 mb-5">
                {/* 1-Click Instant Demo Official Access Card */}
                <div className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield size={14} className="text-[#F7D10C]" />
                    <span className="font-mono text-xs font-bold text-[var(--text-primary)] uppercase">
                      Municipal Highway Authority
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Instant access to the incident response dispatch console.
                  </p>
                  <button
                    type="button"
                    disabled={demoLoading || submitting}
                    onClick={handleQuickDemoLogin}
                    className="w-full mt-3 py-2.5 px-4 rounded-lg bg-[#F7D10C] text-[#09090b] font-mono font-bold text-xs flex items-center justify-center gap-2 transition hover:brightness-105 active:scale-95 disabled:opacity-60 cursor-pointer shadow-sm"
                  >
                    {demoLoading ? (
                      <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                    ) : (
                      <>
                        <Zap size={14} className="fill-black" />
                        <span>⚡ 1-Click Demo Official Login</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Gov Sub-mode Toggle */}
                <div className="flex gap-1 p-1 bg-[var(--bg-elevated)] rounded-lg font-mono text-xs">
                  <button
                    type="button"
                    onClick={() => { setGovMode('signin'); setError(null); setSuccess(null); }}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                      govMode === 'signin'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Official Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => { setGovMode('register'); setError(null); setSuccess(null); }}
                    className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                      govMode === 'register'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    Register Official
                  </button>
                </div>
              </div>
            )}

            {/* CITIZEN SUB-MODE TOGGLE */}
            {tab === 'citizen' && (
              <div className="flex gap-1 mb-5 p-1 bg-[var(--bg-elevated)] rounded-lg font-mono text-xs">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); setSuccess(null); }}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => { setMode('signup'); setError(null); setSuccess(null); }}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Error / Success Messages */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2 font-mono animate-fade-in">
                <AlertCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-500">{error}</p>
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-2 font-mono animate-fade-in">
                <CheckCircle2 size={15} className="text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-500">{success}</p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {((tab === 'citizen' && mode === 'signup') || (tab === 'gov' && govMode === 'register')) && (
                <div>
                  <label className="block font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                    {tab === 'gov' ? 'Official Full Name & Title' : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tab === 'gov' ? 'e.g. Officer Ramesh Rao' : 'Your name'}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                  />
                </div>
              )}

              {tab === 'gov' && govMode === 'register' && (
                <div>
                  <label className="block font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <Building2 size={12} className="text-[#F7D10C]" />
                    Government Department
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Municipal PWD / Road Safety Division"
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                  />
                </div>
              )}

              <div>
                <label className="block font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
                  {tab === 'gov' ? 'Government Email' : 'Email Address'}
                </label>
                <input
                  type="email"
                  required
                  placeholder={tab === 'gov' ? 'official@pwd.gov' : 'citizen@example.com'}
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1">
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
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {tab === 'gov' && govMode === 'register' && (
                <div>
                  <label className="block font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <KeyRound size={12} className="text-[#F7D10C]" />
                      Official Passcode
                    </span>
                    <span className="text-[10px] text-[#F7D10C]">FORGE-GOV-2026</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={passcode}
                    onChange={e => setPasscode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[#F7D10C] font-mono focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || demoLoading}
                className="w-full py-3 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 mt-2 bg-[#F7D10C] text-[#09090b] hover:brightness-105 active:scale-95 shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <div className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                ) : (
                  <>
                    <span>
                      {tab === 'gov'
                        ? govMode === 'register'
                          ? 'Register Official Account'
                          : 'Authorize Official Session'
                        : mode === 'signup'
                        ? 'Create Citizen Profile'
                        : 'Sign In as Citizen'}
                    </span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="text-center font-mono text-[11px] text-[var(--text-muted)]">
          FORGE CIVIC INFRASTRUCTURE • SATELLITE & GEMINI VISION TELEMETRY
        </p>
      </div>
    </main>
  );
}
