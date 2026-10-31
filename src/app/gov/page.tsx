'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, Shield, MapPin, Sparkles, ExternalLink,
  CheckCircle2, Clock, Wrench, Eye, AlertCircle, ArrowLeft,
  ChevronRight, RefreshCw, Filter, Layers, Navigation, AlertTriangle
} from 'lucide-react';
import SeverityBadge from '@/components/SeverityBadge';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { timeAgo, formatCoords, googleMapsUrl, PLACEHOLDER_IMAGE } from '@/lib/utils';
import type { Report, ReportStatus, Severity } from '@/types';

type FilterTab = 'all' | 'Severe' | 'Medium' | 'Repaired';

export default function GovInboxPage() {
  const router = useRouter();
  const { user, session, role, loading: authLoading } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [repairNote, setRepairNote] = useState('');
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [mobileDetailView, setMobileDetailView] = useState(false);

  /* ── 1. Load reports from Supabase ── */
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setReports(data as Report[]);
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
      } else {
        setReports([]);
      }
    } catch {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  /* ── 2. Real-time Subscription ── */
  useEffect(() => {
    fetchReports();

    const channel = supabase
      .channel('gov-reports-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchReports]);

  /* ── 3. Active Incident ── */
  const activeReport = useMemo(() => {
    return reports.find((r) => r.id === selectedId) || null;
  }, [reports, selectedId]);

  /* ── 4. Filtering & Searching ── */
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.user_name?.toLowerCase().includes(q) ||
        r.severity?.toLowerCase().includes(q) ||
        r.ai_reasoning?.toLowerCase().includes(q) ||
        r.latitude.toString().includes(q) ||
        r.longitude.toString().includes(q);

      if (!matchesQuery) return false;

      if (filterTab === 'all') return true;
      if (filterTab === 'Repaired') return r.status === 'Repaired';
      return r.severity === filterTab;
    });
  }, [reports, query, filterTab]);

  /* ── 5. Status Updater ── */
  const handleUpdateStatus = async (newStatus: ReportStatus) => {
    if (!activeReport) return;
    setStatusUpdating(true);
    setStatusMessage(null);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/reports/${activeReport.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update incident status');
      }

      // Optimistic update
      setReports((prev) =>
        prev.map((r) => (r.id === activeReport.id ? { ...r, status: newStatus } : r))
      );
      setStatusMessage({
        type: 'success',
        text: `Incident #${activeReport.id.slice(0, 8)} updated to "${newStatus}"`,
      });
      setShowRepairModal(false);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Status update failed.',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  /* ── 6. Auth Gate / Warning ── */
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
          <p className="text-xs text-zinc-500">Verifying municipal authorization...</p>
        </div>
      </div>
    );
  }

  // If citizen or guest, show security badge and redirect button
  if (!user || role !== 'gov') {
    return (
      <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#121218] border border-[#27272a] rounded-2xl p-6 text-center shadow-2xl">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-400">
            <Shield size={28} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white mb-2">
            Restricted Government Portal
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed mb-6">
            The Government Incident Command Center requires municipal officer authorization.
            Please sign in with your official civic credentials to access road hazard dispatch tools.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/auth')}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-black font-extrabold text-xs uppercase tracking-wider hover:opacity-90 transition"
            >
              Sign In as Gov Official
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition"
            >
              Return to Citizen Feed
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#09090b] text-white flex flex-col">
      {/* ── Subheader / Control Strip ── */}
      <header className="border-b border-[#27272a]/60 bg-[#0f0f12]/80 backdrop-blur px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-sm font-extrabold tracking-tight text-white uppercase flex items-center gap-2">
              Command Center
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                Hubballi-Dharwad Municipal Corp
              </span>
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchReports()}
            disabled={loading}
            className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 transition text-xs flex items-center gap-1.5 px-2.5"
            title="Refresh Feed"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </header>

      {/* ── Main Two-Column Layout (Instagram DM Style) ── */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ============================================================== */}
        {/* LEFT COLUMN: Incident Threads List                             */}
        {/* ============================================================== */}
        <section
          className={`w-full md:w-96 lg:w-[420px] md:border-r border-[#27272a]/60 bg-[#0c0c0e] flex flex-col flex-shrink-0 ${
            mobileDetailView ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Search bar & Filter tabs */}
          <div className="p-3 border-b border-[#27272a]/40 space-y-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Search by ID, coordinates, or AI reasoning..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#141418] border border-[#27272a] rounded-xl pl-8 pr-3 py-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-400/50"
              />
            </div>

            {/* Filter pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              {(['all', 'Severe', 'Medium', 'Repaired'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilterTab(tab)}
                  className={`px-3 py-1 rounded-full font-semibold transition whitespace-nowrap ${
                    filterTab === tab
                      ? 'bg-amber-400 text-black shadow-sm'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-[#27272a]'
                  }`}
                >
                  {tab === 'all' ? 'All Incidents' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Incident Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e1e24]/60">
            {loading && reports.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading municipal reports...
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 text-xs">
                <AlertCircle size={24} className="mx-auto mb-2 text-zinc-600" />
                No incident threads match this query.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = activeReport?.id === report.id;
                const isUninspected = report.status === 'Pending';

                return (
                  <button
                    key={report.id}
                    onClick={() => {
                      setSelectedId(report.id);
                      setMobileDetailView(true);
                      setStatusMessage(null);
                    }}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition relative group ${
                      isSelected ? 'bg-[#181820]' : 'hover:bg-[#121216]'
                    }`}
                  >
                    {/* Uninspected indicator */}
                    {isUninspected && (
                      <span
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-6 rounded-full bg-red-500 shadow-sm shadow-red-500/50"
                        title="Uninspected Incident"
                      />
                    )}

                    {/* Left: Thumbnail */}
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-zinc-900 shrink-0 border border-zinc-800">
                      <img
                        src={report.image_url}
                        alt="Hazard"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                        }}
                      />
                      {isUninspected && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-[#121216] animate-ping" />
                      )}
                    </div>

                    {/* Center: Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <SeverityBadge severity={report.severity} size="sm" />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          report.status === 'Repaired'
                            ? 'text-emerald-400'
                            : report.status === 'In Progress'
                            ? 'text-indigo-400'
                            : report.status === 'Acknowledged'
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        }`}>
                          • {report.status}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-zinc-200 truncate">
                        {formatCoords(report.latitude, report.longitude)}
                      </p>
                      <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                        {report.ai_reasoning || 'AI analysis complete.'}
                      </p>
                    </div>

                    {/* Right: Timestamp */}
                    <div className="text-[10px] font-medium text-zinc-500 shrink-0 text-right self-start mt-0.5">
                      {timeAgo(report.created_at)}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Active Incident Command Center                    */}
        {/* ============================================================== */}
        <main
          className={`flex-1 bg-[#09090b] flex-col overflow-y-auto ${
            mobileDetailView ? 'flex' : 'hidden md:flex'
          }`}
        >
          {activeReport ? (
            <div className="max-w-4xl mx-auto w-full p-4 md:p-6 space-y-6">
              {/* Mobile Back Button */}
              <div className="md:hidden flex items-center justify-between pb-2 border-b border-[#27272a]">
                <button
                  onClick={() => setMobileDetailView(false)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white"
                >
                  <ArrowLeft size={14} /> Back to Incident Threads
                </button>
                <SeverityBadge severity={activeReport.severity} />
              </div>

              {/* Status Message Notification */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fade-in ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-300'
                      : 'bg-red-500/10 border border-red-500/20 text-red-300'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Header Card */}
              <div className="rounded-2xl bg-[#121218] border border-[#27272a] p-4 md:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-xs font-mono font-bold text-zinc-500 uppercase">
                      INC-{activeReport.id.slice(0, 8)}
                    </span>
                    <SeverityBadge severity={activeReport.severity} size="md" />
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        activeReport.status === 'Repaired'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : activeReport.status === 'In Progress'
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                          : activeReport.status === 'Acknowledged'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {activeReport.status}
                    </span>
                  </div>
                  <h2 className="text-lg md:text-xl font-extrabold text-white">
                    Hazard at {formatCoords(activeReport.latitude, activeReport.longitude)}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Reported by <span className="text-zinc-200 font-semibold">{activeReport.user_name || 'Citizen'}</span> • {new Date(activeReport.created_at).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={googleMapsUrl(activeReport.latitude, activeReport.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition"
                  >
                    <ExternalLink size={13} />
                    Open Maps
                  </a>
                </div>
              </div>

              {/* Photo Inspector & Map Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Photo Inspector */}
                <div className="rounded-2xl overflow-hidden bg-[#121218] border border-[#27272a] shadow-2xl flex flex-col">
                  <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-300">High-Res Field Evidence</span>
                    <span>1:1 Aspect Ratio</span>
                  </div>
                  <div className="relative aspect-square bg-zinc-950 flex items-center justify-center">
                    <img
                      src={activeReport.image_url}
                      alt="Incident high-res"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                      }}
                    />
                  </div>
                </div>

                {/* Live Interactive Map Embed */}
                <div className="rounded-2xl overflow-hidden bg-[#121218] border border-[#27272a] shadow-2xl flex flex-col">
                  <div className="px-4 py-3 border-b border-[#27272a] flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Navigation size={13} className="text-lime-400" />
                      Live Coordinate Pin
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {activeReport.latitude.toFixed(4)}, {activeReport.longitude.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex-1 min-h-[300px] bg-zinc-950">
                    <iframe
                      title="OpenStreetMap incident location"
                      width="100%"
                      height="100%"
                      className="w-full h-full min-h-[300px] border-0"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeReport.longitude - 0.005},${activeReport.latitude - 0.005},${activeReport.longitude + 0.005},${activeReport.latitude + 0.005}&layer=mapnik&marker=${activeReport.latitude},${activeReport.longitude}`}
                    />
                  </div>
                </div>
              </div>

              {/* AI Diagnostics Summary Card */}
              <div className="rounded-2xl bg-[#121218] border border-[#27272a] p-4 md:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-lime-500/10 border border-lime-500/20 flex items-center justify-center text-lime-400">
                    <Sparkles size={14} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-lime-300">
                      Gemini Vision Diagnostics
                    </h3>
                    <p className="text-[11px] text-zinc-500">
                      Multimodal road surface analysis
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a]/60">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">AI Confidence</span>
                    <p className="text-base font-extrabold text-white mt-0.5">
                      {activeReport.ai_confidence ? `${Math.round(activeReport.ai_confidence * 100)}%` : '85%'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a]/60">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Suggested Priority</span>
                    <p className="text-base font-extrabold text-white mt-0.5">
                      {activeReport.severity === 'Severe' ? 'P1 - Immediate' : activeReport.severity === 'Medium' ? 'P2 - 48 Hours' : 'P3 - Scheduled'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#09090b] border border-[#27272a]/60">
                    <span className="text-[10px] text-zinc-500 uppercase font-semibold">Public Confirmations</span>
                    <p className="text-base font-extrabold text-white mt-0.5">
                      {activeReport.upvotes || 0} Citizens
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#09090b] border border-[#27272a]/60 text-xs text-zinc-300 leading-relaxed">
                  <span className="font-semibold text-zinc-400 block mb-1">Observation Note:</span>
                  {activeReport.ai_reasoning || 'Deep crater with exposed aggregate; high risk for two-wheelers and passenger vehicles.'}
                </div>
              </div>

              {/* Official Action Controls */}
              <div className="rounded-2xl bg-[#121218] border border-[#27272a] p-4 md:p-5 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Municipal Action Pipeline
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Mark Acknowledged */}
                  <button
                    onClick={() => handleUpdateStatus('Acknowledged')}
                    disabled={statusUpdating || activeReport.status === 'Acknowledged'}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                      activeReport.status === 'Acknowledged'
                        ? 'bg-blue-500/20 text-blue-300 border-blue-500/30 cursor-default'
                        : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 active:scale-95'
                    }`}
                  >
                    <Eye size={14} />
                    Mark Acknowledged
                  </button>

                  {/* Dispatch Repair Team */}
                  <button
                    onClick={() => handleUpdateStatus('In Progress')}
                    disabled={statusUpdating || activeReport.status === 'In Progress'}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                      activeReport.status === 'In Progress'
                        ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 cursor-default'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/20 active:scale-95'
                    }`}
                  >
                    <Wrench size={14} />
                    Dispatch Repair Team
                  </button>

                  {/* Mark Repaired */}
                  <button
                    onClick={() => setShowRepairModal(true)}
                    disabled={statusUpdating || activeReport.status === 'Repaired'}
                    className={`py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition ${
                      activeReport.status === 'Repaired'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 cursor-default'
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 active:scale-95'
                    }`}
                  >
                    <CheckCircle2 size={14} />
                    Mark as Repaired
                  </button>
                </div>
              </div>

              {/* Repair Modal */}
              {showRepairModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                  <div className="max-w-md w-full bg-[#121218] border border-[#27272a] rounded-2xl p-6 space-y-4 animate-slide-up">
                    <div className="flex items-center justify-between">
                      <h4 className="text-base font-bold text-white flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                        Confirm Road Surface Repair
                      </h4>
                      <button
                        onClick={() => setShowRepairModal(false)}
                        className="text-zinc-500 hover:text-white"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-xs text-zinc-400 leading-relaxed">
                      Marking this incident as <strong>Repaired</strong> will update the public feed in real time and close the civic work order.
                    </p>

                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                        Officer Resolution Note (Optional)
                      </label>
                      <textarea
                        placeholder="Asphalt cold-patch applied and leveled. Verified by Ward 12 squad."
                        value={repairNote}
                        onChange={(e) => setRepairNote(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2.5 rounded-xl bg-[#09090b] border border-[#27272a] text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => setShowRepairModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateStatus('Repaired')}
                        disabled={statusUpdating}
                        className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-lime-500 text-black text-xs font-bold hover:scale-[1.02] transition"
                      >
                        {statusUpdating ? 'Updating...' : 'Confirm Repaired'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <Shield size={36} className="text-zinc-700 mb-3" />
              <h3 className="text-sm font-semibold text-zinc-400">No Incident Selected</h3>
              <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                Select an incident thread from the left column to view high-resolution evidence, coordinate mapping, and dispatch controls.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
