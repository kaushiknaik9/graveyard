'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera, MapPin, ThumbsUp, Share2, Sparkles, Navigation,
  Clock, CheckCircle2, Wrench, Eye, X, ChevronUp, AlertTriangle,
  Loader2, ShieldAlert
} from 'lucide-react';
import SeverityBadge from '@/components/SeverityBadge';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { timeAgo, formatCoords, googleMapsUrl } from '@/lib/utils';
import type { Report, ReportStatus } from '@/types';

/* ───────────────────────────── Analysis Steps ───────────────────────────── */
const ANALYSIS_STEPS = [
  { label: 'Locking GPS Coordinates…', icon: Navigation },
  { label: 'Uploading High-Res Snapshot…', icon: Camera },
  { label: 'Gemini Vision Analyzing Asphalt Severity…', icon: Sparkles },
];

/* ───────────────────────────── Status Icons ──────────────────────────────── */
function StatusBadge({ status }: { status: ReportStatus }) {
  const cfg: Record<ReportStatus, { bg: string; text: string; border: string; label: string; Icon: typeof Clock }> = {
    Pending:       { bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20',   label: 'Pending Inspection', Icon: Clock },
    Acknowledged:  { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    label: 'Acknowledged',       Icon: Eye },
    'In Progress': { bg: 'bg-indigo-500/10',  text: 'text-indigo-400',  border: 'border-indigo-500/20',  label: 'Work Order Issued',  Icon: Wrench },
    Repaired:      { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', label: 'Repaired',           Icon: CheckCircle2 },
  };
  const c = cfg[status] || cfg.Pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${c.bg} ${c.text} ${c.border}`}>
      <c.Icon size={10} />
      {c.label}
    </span>
  );
}

/* ───────────────────────────── Placeholder SVG ──────────────────────────── */
const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500"><rect fill="#18181b" width="400" height="500"/><text x="200" y="260" text-anchor="middle" fill="#3f3f46" font-family="system-ui" font-size="14">Image unavailable</text></svg>')}`;

/* ───────────────────────────── Main Page ─────────────────────────────────── */
export default function Home() {
  const { user, session, role } = useAuth();
  const [posts, setPosts] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unauthorizedNotice, setUnauthorizedNotice] = useState(false);
  const [userVotedIds, setUserVotedIds] = useState<Set<string>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

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

  /* ── Check for unauthorized redirect query param ── */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('unauthorized') === 'gov') {
        setUnauthorizedNotice(true);
        // Clean URL without refresh
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  /* ── Fetch reports from Supabase ── */
  const fetchReports = useCallback(async () => {
    try {
      const { data, error: fetchErr } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (!fetchErr && data) {
        setPosts(data as Report[]);
      } else {
        setPosts([]);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();

    // Real-time subscription for live updates
    const channel = supabase
      .channel('reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports]);

  /* ── Handle file selection ── */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if user is authenticated
    if (!user) {
      setError('Please sign in to report a road hazard.');
      window.location.href = '/auth';
      return;
    }

    setError(null);
    setVerifying(true);
    setAnalysisStep(0);

    // Step 1: Get GPS
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPendingCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setPendingFile(file);
        setAnalysisStep(1);

        // Auto-submit or show note input
        setShowNote(true);
      },
      (geoErr) => {
        console.error('[Geo Error]', geoErr);
        setError('Unable to get your location. Please enable Location Services and try again.');
        setVerifying(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );

    // Reset the file input so same file can be re-selected
    e.target.value = '';
  };

  /* ── Submit the report ── */
  const submitReport = async () => {
    if (!pendingFile || !pendingCoords) return;

    setShowNote(false);
    setAnalysisStep(2);

    try {
      const formData = new FormData();
      formData.append('image', pendingFile);
      formData.append('latitude', pendingCoords.lat.toString());
      formData.append('longitude', pendingCoords.lng.toString());
      formData.append('accuracy', pendingCoords.accuracy.toString());
      if (note.trim()) formData.append('note', note.trim());

      const headers: Record<string, string> = {};
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
        setError(result.error || 'Failed to verify. Please try again.');
        setVerifying(false);
        return;
      }

      // Prepend report immediately so it displays instantly
      if (result.report) {
        setPosts((prev) => [result.report, ...prev.filter((p) => p.id !== result.report.id)]);
      }

      // Success — refresh feed
      await fetchReports();
      setNote('');
      setPendingFile(null);
      setPendingCoords(null);
      setVerifying(false);
    } catch (err) {
      console.error('[Submit Error]', err);
      setError('Network error. Please check your connection and try again.');
      setVerifying(false);
    }
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
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/reports/${reportId}/upvote`, {
        method: 'POST',
        headers,
      });

      const json = await res.json();

      if (res.ok) {
        setUserVotedIds(prev => new Set(prev).add(reportId));
        setPosts(prev =>
          prev.map(p => p.id === reportId ? { ...p, upvotes: (p.upvotes || 0) + 1 } : p)
        );
      } else {
        if (res.status === 409) {
          setUserVotedIds(prev => new Set(prev).add(reportId));
        }
        if (json.error) setError(json.error);
      }
    } catch {
      // Silent fail
    }
  };

  /* ── Share ── */
  const handleShare = async (report: Report) => {
    const url = googleMapsUrl(report.latitude, report.longitude);
    const text = `🚨 Road hazard reported: ${report.severity} severity at ${formatCoords(report.latitude, report.longitude)}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Forge Civic Alert', text, url });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-lime-400/30">
      {/* ── Unauthorized Alert Toast ── */}
      {unauthorizedNotice && (
        <div className="sticky top-14 z-40 max-w-md mx-auto px-3 pt-3 animate-slide-up">
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-3 shadow-lg shadow-amber-500/5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-400 shrink-0" />
              <span>Restricted Area: Municipal Official credentials are required to access the Government Inbox.</span>
            </div>
            <button
              onClick={() => setUnauthorizedNotice(false)}
              className="text-amber-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Action Button ── */}
      <button
        onClick={() => {
          if (!user) {
            window.location.href = '/auth';
            return;
          }
          fileRef.current?.click();
        }}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-500 text-black flex items-center justify-center shadow-2xl shadow-lime-400/30 hover:scale-110 active:scale-95 transition-all md:hidden"
        aria-label="Report hazard"
      >
        <Camera size={22} />
      </button>

      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileRef}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Analysis Overlay ── */}
      {verifying && !showNote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in">
          <div className="text-center px-6">
            {/* Radar animation */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full border-2 border-lime-400/20" />
              <div className="absolute inset-2 rounded-full border-2 border-lime-400/10" />
              <div className="absolute inset-4 rounded-full border-2 border-lime-400/5" />
              <div className="absolute inset-0 rounded-full border-t-2 border-lime-400 animate-radar" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles size={24} className="text-lime-400 animate-pulse-glow" />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {ANALYSIS_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === analysisStep;
                const isDone = i < analysisStep;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 transition-all duration-500 ${
                      isDone ? 'opacity-40' : isActive ? 'opacity-100' : 'opacity-20'
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-lime-400" />
                    ) : isActive ? (
                      <StepIcon size={16} className="text-lime-400 animate-pulse" />
                    ) : (
                      <StepIcon size={16} className="text-zinc-600" />
                    )}
                    <span className={`text-sm ${isActive ? 'text-lime-300 font-medium' : 'text-zinc-500'}`}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Note Input Overlay ── */}
      {showNote && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center animate-fade-in">
          <div className="w-full max-w-md bg-[#121212] border border-[#27272a] rounded-t-2xl sm:rounded-2xl p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Almost done!</h3>
              <button
                onClick={() => { setShowNote(false); setVerifying(false); setPendingFile(null); }}
                className="text-zinc-500 hover:text-white transition"
              >
                <X size={20} />
              </button>
            </div>

            {pendingCoords && (
              <div className="flex items-center gap-2 mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <MapPin size={14} className="text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">
                  📍 {formatCoords(pendingCoords.lat, pendingCoords.lng)}
                </span>
              </div>
            )}

            <textarea
              placeholder="Add a note (optional) — e.g., 'Near the bus stop, very deep'"
              value={note}
              onChange={e => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-[#09090b] border border-[#27272a] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-lime-400/30 resize-none mb-4"
            />

            <button
              onClick={submitReport}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 text-black font-extrabold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-lime-400/20 flex items-center justify-center gap-2"
            >
              <ChevronUp size={16} />
              Publish Alert
            </button>
          </div>
        </div>
      )}

      {/* ── Image Zoom Modal ── */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Zoomed hazard"
            className="max-w-full max-h-full rounded-xl object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_SVG; }}
          />
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center text-white hover:bg-white/20 transition"
            onClick={() => setZoomImage(null)}
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* ── Error Toast ── */}
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-slide-up">
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur flex items-center gap-3">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-300 flex-1">{error}</p>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Main Feed ── */}
      <main className="max-w-md mx-auto px-3 pt-4 pb-24">
        {/* Desktop snap button */}
        <div className="hidden md:flex justify-end mb-4">
          <button
            onClick={() => {
              if (!user) {
                window.location.href = '/auth';
                return;
              }
              fileRef.current?.click();
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 text-black font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-lime-400/20"
          >
            <Camera size={16} />
            Snap Pothole
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="text-lime-400 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && posts.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center mx-auto mb-4">
              <Camera size={28} className="text-zinc-600" />
            </div>
            <h3 className="text-lg font-bold text-zinc-400 mb-1">No reports yet</h3>
            <p className="text-sm text-zinc-600 mb-6">Be the first to report a road hazard in your area.</p>
            <button
              onClick={() => {
                if (!user) {
                  window.location.href = '/auth';
                  return;
                }
                fileRef.current?.click();
              }}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 text-black font-bold text-sm hover:scale-105 transition shadow-lg shadow-lime-400/20"
            >
              + Snap a Pothole
            </button>
          </div>
        )}

        {/* Post Cards */}
        <div className="space-y-6">
          {posts.map((post) => (
            <article
              key={post.id}
              className="rounded-2xl overflow-hidden bg-[#121212] border border-[#27272a] shadow-2xl shadow-black/40 animate-fade-in"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300 border border-zinc-600">
                    {(post.user_name?.[0] || 'C').toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white leading-none">
                      {post.user_name || 'Citizen Reporter'}
                    </p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {timeAgo(post.created_at)}
                    </p>
                  </div>
                </div>
                <SeverityBadge severity={post.severity || 'Medium'} />
              </div>

              {/* Image */}
              <div
                className="relative aspect-[4/5] bg-zinc-900 cursor-zoom-in"
                onClick={() => setZoomImage(post.image_url)}
              >
                <img
                  src={post.image_url}
                  alt={`Road hazard — ${post.severity} severity`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_SVG; }}
                />
              </div>

              <div className="p-4 space-y-3">
                {/* Geo Pill */}
                <a
                  href={googleMapsUrl(post.latitude, post.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-800/80 border border-zinc-700/50 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
                >
                  <MapPin size={12} className="text-lime-400" />
                  {formatCoords(post.latitude, post.longitude)}
                </a>

                {/* AI Assessment */}
                {post.ai_reasoning && (
                  <div className="p-3 rounded-xl bg-[#0a0a0f] border border-[#1e1e28]">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles size={12} className="text-lime-400" />
                      <span className="text-[10px] font-bold text-lime-400 uppercase tracking-wider">AI Assessment</span>
                      {post.ai_confidence && (
                        <span className="text-[10px] text-zinc-600 ml-auto">
                          {Math.round(post.ai_confidence * 100)}% confidence
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-zinc-300 leading-relaxed">
                      {post.ai_reasoning}
                    </p>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex items-center gap-2 pt-1">
                  {(() => {
                    const hasVoted = userVotedIds.has(post.id);
                    return (
                      <button
                        onClick={() => handleUpvote(post.id)}
                        disabled={hasVoted}
                        title={hasVoted ? 'You have already confirmed this report' : 'Confirm this hazard report'}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition border ${
                          hasVoted
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 cursor-default shadow-sm shadow-emerald-500/10'
                            : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border-zinc-700/50 hover:text-white active:scale-95'
                        }`}
                      >
                        <ThumbsUp size={13} className={hasVoted ? 'fill-emerald-400' : ''} />
                        {hasVoted ? '✓ Confirmed' : `${post.upvotes || 0} Confirmations`}
                        {hasVoted && (
                          <span className="text-[11px] opacity-75 font-mono ml-0.5">
                            ({post.upvotes || 1})
                          </span>
                        )}
                      </button>
                    );
                  })()}
                  <button
                    onClick={() => handleShare(post)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-xs font-semibold text-zinc-300 transition border border-zinc-700/50"
                  >
                    <Share2 size={13} />
                    Share
                  </button>
                </div>

                {/* Status Badge */}
                <div className="pt-1">
                  <StatusBadge status={(post.status as ReportStatus) || 'Pending'} />
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}
