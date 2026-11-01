'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Camera,
  MapPin,
  Sparkles,
  Navigation,
  CheckCircle2,
  X,
  ShieldAlert,
  Layers,
  LayoutGrid,
  Map,
  Plus,
  Compass,
  Building2,
  Radio,
  Clock,
  ArrowUpRight,
  TrendingUp,
  AlertCircle,
  Activity,
  Filter,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import CameraCaptureModal from '@/components/CameraCaptureModal';
import ReportCard from '@/components/ReportCard';
import HazardMap from '@/components/HazardMap';
import type { Report } from '@/types';

type FilterTab = 'all' | 'Severe' | 'Pending' | 'Repaired';

export default function Home() {
  const router = useRouter();
  const { user, session, role, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'feed' | 'map'>('feed');
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');

  // Enforce authentication: unauthenticated users cannot access feed
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/auth');
    }
  }, [user, authLoading, router]);

  // Modal & Verification states
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionStep, setSubmissionStep] = useState<string | null>(null);

  // Overlays & Notifications
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [unauthorizedNotice, setUnauthorizedNotice] = useState(false);

  // Single-vote citizen tracking
  const [userVotedIds, setUserVotedIds] = useState<Set<string>>(new Set());

  /* ── Check for unauthorized redirect query param ── */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('unauthorized') === 'gov') {
        setUnauthorizedNotice(true);
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  /* ── Fetch which reports the current logged-in citizen has already confirmed ── */
  useEffect(() => {
    if (!user) {
      setUserVotedIds(new Set());
      return;
    }

    supabase
      .from('report_upvotes')
      .select('report_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setUserVotedIds(new Set(data.map((d: any) => d.report_id)));
        }
      });
  }, [user]);

  /* ── Fetch reports from Supabase with API fallback ── */
  const fetchReports = useCallback(async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchErr && data) {
        setPosts(data as Report[]);
      } else {
        const res = await fetch('/api/reports', {
          headers: { 'x-forge-client': 'forge-next-frontend-v1' },
        });
        if (res.ok) {
          const json = await res.json();
          setPosts(json.reports || []);
        } else {
          setPosts([]);
        }
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();

    // Live Real-time subscription
    const channel = supabase
      .channel('reports-realtime-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports]);

  /* ── Submit New Report from CameraCaptureModal ── */
  const handleSubmitReport = async (
    file: File,
    coords: { lat: number; lng: number; accuracy: number },
    note: string
  ) => {
    setIsSubmitting(true);
    setSubmissionStep('Locating street address & nearest municipal ward…');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('latitude', coords.lat.toString());
      formData.append('longitude', coords.lng.toString());
      formData.append('accuracy', coords.accuracy.toString());
      if (note.trim()) formData.append('note', note.trim());

      setSubmissionStep('Analyzing road damage & verifying hazard…');

      const headers: Record<string, string> = {
        'x-forge-client': 'forge-next-frontend-v1',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch('/api/verify', {
        method: 'POST',
        headers,
        body: formData,
      });

      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Verification failed. Please ensure photo shows an actual road hazard.');
        setIsSubmitting(false);
        setSubmissionStep(null);
        return;
      }

      setSubmissionStep('Routing report to nearest Municipal Division…');

      if (result.report) {
        setPosts((prev) => [result.report, ...prev.filter((p) => p.id !== result.report.id)]);
      }

      await fetchReports();
      setIsCameraModalOpen(false);
      setSuccessToast(`Hazard alert published! Routed to ${result.report?.ward || 'Nearest Municipal Road Division'}.`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: any) {
      console.error('[Publish Error]', err);
      setError('Network communication failed. Please check connection and try again.');
    } finally {
      setIsSubmitting(false);
      setSubmissionStep(null);
    }
  };

  /* ── Boost / Confirm Existing Hazard within 25m ── */
  const handleBoostExisting = async (reportId: string) => {
    await handleUpvote(reportId);
    setSuccessToast('✓ Nearby hazard boosted! Your confirmation has raised its dispatch priority.');
    setTimeout(() => setSuccessToast(null), 5000);
  };

  /* ── Upvote / Confirm a report (Strictly 1 vote per citizen) ── */
  const handleUpvote = async (reportId: string) => {
    if (!user) {
      window.location.href = '/auth';
      return;
    }

    if (userVotedIds.has(reportId)) {
      setError('You have already confirmed this road hazard. One vote per citizen is allowed.');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'x-forge-client': 'forge-next-frontend-v1',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/reports/${reportId}/upvote`, {
        method: 'POST',
        headers,
      });

      const json = await res.json();

      if (res.ok) {
        setUserVotedIds((prev) => new Set(prev).add(reportId));
        setPosts((prev) =>
          prev.map((p) => (p.id === reportId ? { ...p, upvotes: (p.upvotes || 0) + 1 } : p))
        );
      } else {
        if (res.status === 409) {
          setUserVotedIds((prev) => new Set(prev).add(reportId));
        }
        if (json.error) setError(json.error);
      }
    } catch {
      // Silent fail
    }
  };

  /* ── Computed Live Bento KPIs ── */
  const kpis = useMemo(() => {
    const total = posts.length;
    const severe = posts.filter((p) => p.severity === 'Severe').length;
    const inProgress = posts.filter((p) => p.status === 'In Progress' || p.status === 'Acknowledged').length;
    const repaired = posts.filter((p) => p.status === 'Repaired').length;
    const resolutionRate = total > 0 ? Math.round((repaired / total) * 100) : 0;
    const unresolved = total - repaired;

    return { total, severe, inProgress, repaired, resolutionRate, unresolved };
  }, [posts]);

  /* ── Filtered Posts ── */
  const filteredPosts = useMemo(() => {
    if (activeFilter === 'all') return posts;
    if (activeFilter === 'Severe') return posts.filter((p) => p.severity === 'Severe');
    if (activeFilter === 'Pending') return posts.filter((p) => p.status === 'Pending');
    if (activeFilter === 'Repaired') return posts.filter((p) => p.status === 'Repaired');
    return posts;
  }, [posts, activeFilter]);

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#F7D10C] border-t-transparent animate-spin mx-auto" />
          <p className="font-mono text-xs text-[var(--text-secondary)]">Authenticating Civic Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-primary)] font-sans">
      {/* ── Notification Toasts ── */}
      {unauthorizedNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-slide-up">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center justify-between gap-3 shadow-xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span>Municipal Official credentials are required for the Command Center.</span>
            </div>
            <button onClick={() => setUnauthorizedNotice(false)} className="hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {successToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-slide-up">
          <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-emerald-500/40 text-[var(--text-primary)] text-xs flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <span className="font-medium">{successToast}</span>
            </div>
            <button onClick={() => setSuccessToast(null)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-slide-up">
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs flex items-center justify-between gap-3 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="hover:text-red-400 cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Fullscreen Submission Radar Overlay ── */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center animate-fade-in p-6">
          <div className="text-center max-w-sm">
            <div className="relative w-20 h-20 mx-auto mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-[#F7D10C]/20" />
              <div className="absolute inset-0 rounded-full border-t-2 border-[#F7D10C] animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={22} className="text-[#F7D10C] animate-pulse" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-white mb-1.5 font-mono">VERIFYING ROAD HAZARD</h3>
            <p className="text-xs text-zinc-300 font-medium leading-relaxed">
              {submissionStep}
            </p>
          </div>
        </div>
      )}

      {/* ── 3-COLUMN ENTERPRISE COMMAND SHELL (12-Col Grid) ── */}
      <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-4rem)]">
        {/* ============================================================== */}
        {/* COLUMN 1: LEFT NAVIGATION & TELEMETRY RAIL (col-span-3)        */}
        {/* ============================================================== */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col justify-between border-r border-[var(--border-subtle)] p-6 sticky top-16 h-[calc(100vh-4rem)] bg-[var(--bg-canvas)]">
          <div className="space-y-5">
            {/* Logo Brand Header */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <img src="/Logo.png" alt="Forge Logo" className="w-10 h-10 rounded-xl object-contain bg-[var(--bg-elevated)] p-1 border border-[var(--border-subtle)]" />
              <div>
                <h3 className="text-xs font-extrabold text-[var(--text-primary)] tracking-tight">Civic Road Safety</h3>
                <p className="font-mono text-[10px] text-[var(--text-muted)]">Real-Time Municipal Dispatch</p>
              </div>
            </div>

            {/* Primary Action Button - CITIZEN ONLY */}
            {role === 'citizen' ? (
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="w-full bg-[#F7D10C] text-[#09090b] font-bold py-3 px-4 rounded-xl shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer text-xs uppercase tracking-wider font-mono"
              >
                <Plus size={16} strokeWidth={3} />
                <span>Report Road Hazard</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-secondary)] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#F7D10C]" />
                <span className="font-bold text-[var(--text-primary)]">Municipal Inspector Mode</span>
              </div>
            )}

            {/* Navigation Menu Rail */}
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setViewMode('feed')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'feed'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold border-l-2 border-[#F7D10C]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutGrid size={15} />
                  <span>Live Civic Feed</span>
                </div>
                <span className="font-mono text-[10px] text-[var(--text-muted)]">
                  {posts.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold border-l-2 border-[#F7D10C]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Map size={15} />
                  <span>Geospatial Radar</span>
                </div>
                <span className="w-2 h-2 rounded-full bg-[#F7D10C]" />
              </button>

              {/* MUNICIPAL DASHBOARD LINK - GOV ONLY (Hidden from citizens) */}
              {role === 'gov' && (
                <Link
                  href="/gov"
                  className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 size={15} />
                    <span>Municipal Dashboard</span>
                  </div>
                  {kpis.unresolved > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-500 font-mono text-[10px] font-bold border border-amber-500/20">
                      {kpis.unresolved} active
                    </span>
                  )}
                </Link>
              )}
            </nav>

            {/* Authenticated Account Status */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
              <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center font-mono font-bold text-xs text-[var(--text-primary)]">
                  {(user.email?.[0] || 'U').toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-bold text-[var(--text-primary)] block truncate">
                    {user.user_metadata?.user_name || user.email?.split('@')[0] || 'User'}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-muted)] block truncate">
                    {role === 'gov' ? 'Municipal Official' : 'Verified Citizen'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Citizen Action Guide */}
          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                CITIZEN ACTION
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-[#F7D10C] animate-pulse" />
            </div>
            <h4 className="text-xs font-bold text-[var(--text-primary)]">
              Report & Track Road Hazards
            </h4>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Capture potholes and road damage. Community confirmations escalate urgent repairs directly to active municipal repair crews.
            </p>
          </div>
        </aside>

        {/* ============================================================== */}
        {/* COLUMN 2: CENTER FEED & MAP VIEWPORT (col-span-6)              */}
        {/* ============================================================== */}
        <main className="col-span-1 lg:col-span-6 border-r border-[var(--border-subtle)] min-h-screen flex flex-col">
          {/* Sticky Sub-Header: Segmented View Switcher & Filter Chips */}
          <div className="sticky top-16 z-20 backdrop-blur-xl bg-[var(--bg-canvas)]/85 border-b border-[var(--border-subtle)] px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            {/* Sliding Pill View Switcher */}
            <div className="flex p-0.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono text-xs">
              <button
                type="button"
                onClick={() => setViewMode('feed')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  viewMode === 'feed'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Feed Stream
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`px-3 py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                  viewMode === 'map'
                    ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                Live Radar Map
              </button>
            </div>

            {/* Severity Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs font-mono">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'Severe', label: 'Severe' },
                  { id: 'Pending', label: 'Pending' },
                  { id: 'Repaired', label: 'Repaired' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                    activeFilter === tab.id
                      ? 'bg-[var(--text-primary)] text-[var(--bg-canvas)] font-bold'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* View Container */}
          <div className="p-4 sm:p-5 flex-1">
            {viewMode === 'map' ? (
              <div className="animate-fade-in">
                <HazardMap
                  reports={filteredPosts}
                  onUpvote={handleUpvote}
                  userVotedIds={userVotedIds}
                />
              </div>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        className="h-80 rounded-2xl bg-[var(--bg-elevated)] animate-pulse border border-[var(--border-subtle)]"
                      />
                    ))}
                  </div>
                ) : filteredPosts.length === 0 ? (
                  <div className="p-12 text-center rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                    <div className="w-12 h-12 rounded-xl bg-[var(--bg-elevated)] text-[var(--text-muted)] flex items-center justify-center mx-auto mb-3">
                      <Camera size={22} />
                    </div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-mono">
                      No Incidents Found
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                      All roads are clear or match no filters in this zone. Capture asphalt damage to alert municipal dispatch.
                    </p>
                    {role === 'citizen' && (
                      <button
                        type="button"
                        onClick={() => setIsCameraModalOpen(true)}
                        className="mt-4 px-4 py-2 rounded-xl bg-[#F7D10C] text-[#09090b] text-xs font-bold font-mono hover:brightness-105 transition cursor-pointer"
                      >
                        + Snap Pothole
                      </button>
                    )}
                  </div>
                ) : (
                  filteredPosts.map((post) => (
                    <ReportCard
                      key={post.id}
                      report={post}
                      onUpvote={handleUpvote}
                      hasVoted={userVotedIds.has(post.id)}
                      onZoomImage={(url) => setZoomImage(url)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </main>

        {/* ============================================================== */}
        {/* COLUMN 3: RIGHT CIVIC INTELLIGENCE PANEL (col-span-3)          */}
        {/* ============================================================== */}
        <aside className="hidden lg:flex lg:col-span-3 flex-col gap-5 p-6 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto bg-[var(--bg-canvas)]">
          {/* 2x2 Bento KPI Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase block mb-1">
                Total Reported
              </span>
              <span className="font-mono text-2xl font-bold text-[var(--text-primary)]">
                {kpis.total}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Severe
                </span>
              </div>
              <span className="font-mono text-2xl font-bold text-red-500">
                {kpis.severe}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Dispatched
                </span>
              </div>
              <span className="font-mono text-2xl font-bold text-amber-500">
                {kpis.inProgress}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase">
                  Repaired
                </span>
              </div>
              <span className="font-mono text-2xl font-bold text-emerald-500">
                {kpis.resolutionRate}%
              </span>
            </div>
          </div>

          {/* Mini-Radar Map Preview */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="p-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-[#F7D10C]" />
                <span className="font-mono text-xs font-bold text-[var(--text-primary)]">
                  Live Radar Grid
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className="font-mono text-[11px] text-[#F7D10C] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Expand ↗</span>
              </button>
            </div>
            <div className="h-[180px] w-full bg-zinc-950 relative">
              <iframe
                title="Mini Map Preview"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=75.07%2C15.34%2C75.17%2C15.42&layer=mapnik`}
                className="w-full h-full filter contrast-125 brightness-90 pointer-events-none"
              />
            </div>
          </div>

          {/* Community Action Card */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
              <TrendingUp size={14} className="text-[#F7D10C]" />
              <span>How Citizen Voting Works</span>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Every citizen who sees a pothole can tap &quot;+1 Confirm Hazard&quot;. Verified reports with more confirmations are escalated to the top of the municipal repair queue.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Camera Capture Modal ── */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onSubmit={handleSubmitReport}
        onBoostExisting={handleBoostExisting}
        existingReports={posts}
      />

      {/* ── High-Res Image Zoom Modal ── */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Zoomed Road Hazard"
            className="max-w-full max-h-[90vh] rounded-2xl object-contain shadow-2xl"
          />
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
