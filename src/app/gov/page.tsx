'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Shield,
  MapPin,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  Wrench,
  Eye,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  RefreshCw,
  Filter,
  Layers,
  Navigation,
  AlertTriangle,
  Download,
  Flame,
  Truck,
  Check,
  Camera,
  Activity,
  FileSpreadsheet,
} from 'lucide-react';
import SeverityBadge from '@/components/SeverityBadge';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import { timeAgo, formatCoords, googleMapsUrl, PLACEHOLDER_IMAGE } from '@/lib/utils';
import type { Report, ReportStatus, Severity } from '@/types';

type FilterTab = 'all' | 'Severe' | 'Medium' | 'Repaired' | 'Breach';
type SortMode = 'priority' | 'newest' | 'upvotes' | 'severity';

function calculatePriorityScore(r: Report): number {
  const sevWeight = r.severity === 'Severe' ? 3 : r.severity === 'Medium' ? 2 : 1;
  const hoursUnresolved = Math.max(0, (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60));
  const upvotes = r.upvotes || 0;
  return Math.round(sevWeight * 30 + upvotes * 10 + hoursUnresolved * 2);
}

function isSlaBreached(r: Report): boolean {
  if (r.status === 'Repaired') return false;
  const hoursUnresolved = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60);
  return r.severity === 'Severe' && hoursUnresolved >= 48;
}

export default function GovInboxPage() {
  const router = useRouter();
  const { user, session, role, loading: authLoading } = useAuth();

  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [sortMode, setSortMode] = useState<SortMode>('priority');

  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Resolution Modal States
  const [showRepairModal, setShowRepairModal] = useState(false);
  const [repairNote, setRepairNote] = useState('');
  const [repairImageUrl, setRepairImageUrl] = useState('');
  const [uploadingRepairPhoto, setUploadingRepairPhoto] = useState(false);

  // Mobile Master-Detail view switch
  const [mobileDetailView, setMobileDetailView] = useState(false);

  // Strictly enforce Municipal Official access: citizens and unauthenticated are redirected
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.replace('/auth?redirect=/gov');
      } else if (role !== 'gov') {
        router.replace('/');
      }
    }
  }, [user, role, authLoading, router]);

  /* ── 1. Load reports from Supabase with API fallback ── */
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
        const res = await fetch('/api/reports', {
          headers: { 'x-forge-client': 'forge-next-frontend-v1' },
        });
        if (res.ok) {
          const json = await res.json();
          setReports(json.reports || []);
          if (json.reports?.length > 0 && !selectedId) {
            setSelectedId(json.reports[0].id);
          }
        }
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

  /* ── 4. Filtering & Sorting ── */
  const filteredReports = useMemo(() => {
    let result = reports.filter((r) => {
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.address?.toLowerCase().includes(q) ||
        r.ward?.toLowerCase().includes(q) ||
        r.user_name?.toLowerCase().includes(q) ||
        r.severity?.toLowerCase().includes(q) ||
        r.ai_reasoning?.toLowerCase().includes(q) ||
        r.latitude.toString().includes(q) ||
        r.longitude.toString().includes(q);

      if (!matchesQuery) return false;

      if (filterTab === 'all') return true;
      if (filterTab === 'Breach') return isSlaBreached(r);
      if (filterTab === 'Repaired') return r.status === 'Repaired';
      return r.severity === filterTab;
    });

    result.sort((a, b) => {
      if (sortMode === 'priority') {
        return calculatePriorityScore(b) - calculatePriorityScore(a);
      }
      if (sortMode === 'upvotes') {
        return (b.upvotes || 0) - (a.upvotes || 0);
      }
      if (sortMode === 'severity') {
        const weight = (s: Severity) => (s === 'Severe' ? 3 : s === 'Medium' ? 2 : 1);
        return weight(b.severity) - weight(a.severity);
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return result;
  }, [reports, query, filterTab, sortMode]);

  /* ── 5. Executive Top Bar KPI Statistics ── */
  const stats = useMemo(() => {
    const total = reports.length;
    const active = reports.filter((r) => r.status !== 'Repaired').length;
    const breaches = reports.filter((r) => isSlaBreached(r)).length;
    const crewsDeployed = reports.filter((r) => r.status === 'In Progress').length;
    const repaired = reports.filter((r) => r.status === 'Repaired').length;
    const resolutionRate = total > 0 ? Math.round((repaired / total) * 100) : 0;

    return { total, active, breaches, crewsDeployed, repaired, resolutionRate };
  }, [reports]);

  /* ── 6. Status Updater ── */
  const handleUpdateStatus = async (
    newStatus: ReportStatus,
    optionalResolution?: { note?: string; imageUrl?: string }
  ) => {
    if (!activeReport) return;
    setStatusUpdating(true);
    setStatusMessage(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-forge-client': 'forge-next-frontend-v1',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/reports/${activeReport.id}/status`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          status: newStatus,
          resolution_note: optionalResolution?.note,
          resolution_image_url: optionalResolution?.imageUrl,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to update incident status');
      }

      setReports((prev) =>
        prev.map((r) =>
          r.id === activeReport.id
            ? {
                ...r,
                status: newStatus,
                resolution_note: optionalResolution?.note || r.resolution_note,
                resolution_image_url: optionalResolution?.imageUrl || r.resolution_image_url,
                resolution_officer: user?.email || 'Municipal Official',
              }
            : r
        )
      );

      setStatusMessage({
        type: 'success',
        text: `Docket INC-${activeReport.id.slice(0, 8)} status marked as "${newStatus}"`,
      });
      setShowRepairModal(false);
      setRepairNote('');
      setRepairImageUrl('');
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Status update failed.',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  /* ── 7. Proof Photo Upload ── */
  const handleProofPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingRepairPhoto(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `repaired-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('potholes')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('potholes').getPublicUrl(data.path);
      setRepairImageUrl(urlData.publicUrl);
    } catch (err: any) {
      const reader = new FileReader();
      reader.onload = () => setRepairImageUrl(reader.result as string);
      reader.readAsDataURL(file);
    } finally {
      setUploadingRepairPhoto(false);
    }
  };

  /* ── 8. Bulk CSV Export / Civic Audit Log ── */
  const handleExportCsv = () => {
    if (filteredReports.length === 0) {
      alert('No reports available in the current filter to export.');
      return;
    }

    const headers = [
      'Incident ID',
      'Street Address',
      'Ward',
      'Assigned Zone',
      'Latitude',
      'Longitude',
      'Severity',
      'Status',
      'Citizen Confirmations',
      'Priority Score',
      'Reported Date',
      'Resolution Officer',
      'Resolution Note',
    ];

    const rows = filteredReports.map((r) => [
      `INC-${r.id.slice(0, 8)}`,
      `"${(r.address || '').replace(/"/g, '""')}"`,
      `"${(r.ward || '').replace(/"/g, '""')}"`,
      `"${(r.assigned_zone || '').replace(/"/g, '""')}"`,
      r.latitude.toFixed(5),
      r.longitude.toFixed(5),
      r.severity,
      r.status,
      r.upvotes || 0,
      calculatePriorityScore(r),
      new Date(r.created_at).toLocaleString(),
      `"${(r.resolution_officer || '').replace(/"/g, '""')}"`,
      `"${(r.resolution_note || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `hdmc-ward-potholes-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (authLoading || !user || role !== 'gov') {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-canvas)] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-full border-2 border-[#F7D10C] border-t-transparent animate-spin mx-auto" />
          <p className="font-mono text-xs text-[var(--text-secondary)]">Verifying Municipal Authority Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[var(--bg-canvas)] text-[var(--text-primary)] flex flex-col font-sans">
      {/* ── TOP EXECUTIVE KPI BAR ── */}
      <section className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 sm:px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Metrics Strip */}
          <div className="flex items-center gap-5 overflow-x-auto pb-1 md:pb-0 font-mono text-xs">
            <div className="flex items-center gap-2.5 pr-3 border-r border-[var(--border-subtle)]">
              <img src="/Logo.png" alt="Forge Logo" className="w-8 h-8 rounded-lg object-contain bg-[var(--bg-elevated)] p-0.5 border border-[var(--border-subtle)]" />
              <div>
                <span className="font-extrabold text-xs text-[var(--text-primary)] tracking-tight block">MUNICIPAL DESK</span>
                <span className="text-[10px] text-[var(--text-muted)]">Local Ward Operations</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-[var(--text-muted)] uppercase block">Active Queue</span>
              <span className="text-base font-bold text-[var(--text-primary)]">{stats.active}</span>
            </div>

            <div className="border-l border-[var(--border-subtle)] pl-4">
              <span className="text-[10px] text-[var(--text-muted)] uppercase block flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                SLA Breaches (&gt;48h)
              </span>
              <span className="text-base font-bold text-red-500">{stats.breaches}</span>
            </div>

            <div className="border-l border-[var(--border-subtle)] pl-4">
              <span className="text-[10px] text-[var(--text-muted)] uppercase block flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Crews Deployed
              </span>
              <span className="text-base font-bold text-amber-500">{stats.crewsDeployed}</span>
            </div>

            <div className="border-l border-[var(--border-subtle)] pl-4">
              <span className="text-[10px] text-[var(--text-muted)] uppercase block">Resolution Rate</span>
              <span className="text-base font-bold text-emerald-500">{stats.resolutionRate}%</span>
            </div>
          </div>

          {/* Quick Actions Strip */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="p-1.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download size={13} className="text-[#F7D10C]" />
              <span>Export Ward CSV</span>
            </button>

            <button
              type="button"
              onClick={() => fetchReports()}
              disabled={loading}
              className="p-1.5 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-xs font-mono flex items-center gap-1.5 transition cursor-pointer"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Sync</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── SPLIT MASTER-DETAIL WORKSPACE (12-Col Grid) ── */}
      <div className="flex-1 max-w-[1440px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 min-h-0 relative">
        {/* ============================================================== */}
        {/* LEFT QUEUE: Incident Rows (lg:col-span-4)                      */}
        {/* ============================================================== */}
        <section
          className={`col-span-1 lg:col-span-5 border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col ${
            mobileDetailView ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search, Filter & Sort bar */}
          <div className="p-3 border-b border-[var(--border-subtle)] space-y-2.5">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search street, ward, ID, severity…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1 overflow-x-auto pb-0.5 text-[11px] font-mono font-bold">
              {(
                [
                  { id: 'all', label: `All (${reports.length})` },
                  { id: 'Severe', label: 'Severe' },
                  { id: 'Breach', label: 'SLA Breach' },
                  { id: 'Medium', label: 'Medium' },
                  { id: 'Repaired', label: 'Repaired' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md shrink-0 transition-colors cursor-pointer ${
                    filterTab === tab.id
                      ? tab.id === 'Breach'
                        ? 'bg-red-500 text-white'
                        : 'bg-[var(--text-primary)] text-[var(--bg-canvas)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sorting Row */}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)] font-mono pt-1">
              <span className="flex items-center gap-1">
                <Filter size={11} className="text-[#F7D10C]" />
                <span>Sort:</span>
              </span>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="bg-transparent text-xs font-bold text-[var(--text-primary)] focus:outline-none cursor-pointer"
              >
                <option value="priority" className="bg-[var(--bg-surface)]">Priority Score (Highest)</option>
                <option value="newest" className="bg-[var(--bg-surface)]">Newest Reported</option>
                <option value="upvotes" className="bg-[var(--bg-surface)]">Most Confirmations</option>
                <option value="severity" className="bg-[var(--bg-surface)]">Severity Rank</option>
              </select>
            </div>
          </div>

          {/* Incident Threads List */}
          <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
            {loading ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs font-mono">
                <RefreshCw size={16} className="animate-spin mx-auto mb-2 text-[#F7D10C]" />
                Loading municipal threads…
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="p-8 text-center text-[var(--text-muted)] text-xs font-mono">
                <AlertCircle size={22} className="mx-auto mb-2" />
                No incident dockets match this filter.
              </div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = activeReport?.id === report.id;
                const isUninspected = report.status === 'Pending';
                const breach = isSlaBreached(report);
                const score = calculatePriorityScore(report);

                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(report.id);
                      setMobileDetailView(true);
                      setStatusMessage(null);
                    }}
                    className={`w-full text-left p-3.5 flex items-center gap-3 transition-colors relative cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--bg-elevated)] border-l-2 border-[#F7D10C]'
                        : 'hover:bg-[var(--bg-elevated-hover)]'
                    }`}
                  >
                    {/* Uninspected indicator */}
                    {isUninspected && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-red-500" />
                    )}

                    {/* Thumbnail */}
                    <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-950 shrink-0 border border-[var(--border-subtle)]">
                      <img
                        src={report.image_url}
                        alt="Hazard"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
                        }}
                      />
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <SeverityBadge severity={report.severity} size="sm" />
                          {breach && (
                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-mono font-bold animate-pulse">
                              SLA BREACH
                            </span>
                          )}
                        </div>

                        <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-[var(--bg-canvas)] text-[var(--text-secondary)] font-bold border border-[var(--border-subtle)]">
                          P-{score}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {report.address || formatCoords(report.latitude, report.longitude)}
                      </p>

                      <div className="flex items-center justify-between font-mono text-[11px] text-[var(--text-muted)] mt-1">
                        <span className="truncate max-w-[120px]">
                          {report.ward || 'Municipal Ward'}
                        </span>
                        <span>{timeAgo(report.created_at)}</span>
                      </div>
                    </div>

                    <ChevronRight size={14} className="text-[var(--text-muted)] shrink-0" />
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* ============================================================== */}
        {/* RIGHT INSPECTOR: Active Incident Workspace (lg:col-span-8)     */}
        {/* ============================================================== */}
        <main
          className={`col-span-1 lg:col-span-7 bg-[var(--bg-canvas)] flex-col overflow-y-auto ${
            mobileDetailView
              ? 'flex fixed inset-0 z-50 bg-[var(--bg-canvas)] overflow-y-auto p-4 sm:p-6 pb-24 animate-slide-up lg:static lg:p-6 lg:z-auto lg:animate-none'
              : 'hidden lg:flex'
          }`}
        >
          {activeReport ? (
            <div className="w-full space-y-5">
              {/* Top Sticky Bar Inside Mobile Drawer (< 1024px) */}
              <div className="lg:hidden sticky -top-4 -mx-4 -mt-4 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-xl z-30 flex items-center justify-between gap-3 shadow-md select-none">
                <button
                  type="button"
                  onClick={() => setMobileDetailView(false)}
                  className="min-h-[44px] flex items-center gap-2 font-mono text-xs font-bold text-[#F7D10C] active:scale-95 transition-transform cursor-pointer"
                >
                  <ArrowLeft size={18} />
                  <span>← Back to Incident Queue</span>
                </button>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-bold text-[var(--text-muted)]">
                    INC-{activeReport.id.slice(0, 8)}
                  </span>
                  <SeverityBadge severity={activeReport.severity} size="sm" />
                </div>
              </div>

              {/* Status Message Notification Toast */}
              {statusMessage && (
                <div
                  className={`p-3.5 rounded-xl text-xs font-semibold font-mono flex items-center gap-2 animate-fade-in ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                      : 'bg-red-500/10 border border-red-500/30 text-red-500'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 size={16} className="shrink-0" />
                  ) : (
                    <AlertTriangle size={16} className="shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* SLA Breach Alert Banner */}
              {isSlaBreached(activeReport) && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 flex items-center justify-between gap-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <Flame size={20} className="shrink-0" />
                    <div>
                      <h4 className="font-mono text-xs font-bold uppercase tracking-wider">
                        CRITICAL SLA BREACH RISK (&gt;48h Unresolved)
                      </h4>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        High-severity damage on a public municipal corridor exceeding guaranteed response window.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Header Card */}
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-mono text-xs font-bold text-[var(--text-muted)]">
                      INC-{activeReport.id.slice(0, 8)}
                    </span>
                    <SeverityBadge severity={activeReport.severity} />
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] font-bold border border-[var(--border-subtle)]">
                      Priority Score: {calculatePriorityScore(activeReport)}
                    </span>
                  </div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)] mt-1">
                    {activeReport.address || 'Street Location'}
                  </h2>
                  <p className="font-mono text-xs text-[var(--text-secondary)] mt-0.5">
                    {activeReport.ward} • {activeReport.assigned_zone || 'Municipal Division'}
                  </p>
                </div>

                <a
                  href={googleMapsUrl(activeReport.latitude, activeReport.longitude)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] text-xs font-mono font-bold flex items-center gap-1.5 transition border border-[var(--border-subtle)] shrink-0"
                >
                  <Navigation size={13} className="text-[#F7D10C]" />
                  <span>Open in Maps</span>
                </a>
              </div>

              {/* Side-by-side Evidence Photo + Interactive Map */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Photo Frame */}
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-3">
                  <div className="flex items-center justify-between font-mono text-[11px] text-[var(--text-muted)]">
                    <span className="uppercase font-bold">Citizen Photo Evidence</span>
                    <span>By {activeReport.user_name || 'Citizen'}</span>
                  </div>

                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-[var(--border-subtle)]">
                    <img
                      src={activeReport.image_url}
                      alt="Hazard Evidence"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {activeReport.resolution_image_url && (
                    <div>
                      <h5 className="font-mono text-[11px] font-bold text-emerald-500 uppercase tracking-wider mb-1">
                        Proof of Repair Photo:
                      </h5>
                      <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-zinc-950 border border-emerald-500/30">
                        <img
                          src={activeReport.resolution_image_url}
                          alt="Repaired Evidence"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* OpenStreetMap Geo Frame */}
                <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-4 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                    <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                      <MapPin size={13} className="text-[#F7D10C]" />
                      <span>GPS Telemetry</span>
                    </div>
                    <span>{formatCoords(activeReport.latitude, activeReport.longitude)}</span>
                  </div>

                  <div className="relative flex-1 min-h-[220px] rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-zinc-950">
                    <iframe
                      title="Incident Map"
                      width="100%"
                      height="100%"
                      frameBorder="0"
                      scrolling="no"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeReport.longitude - 0.004}%2C${activeReport.latitude - 0.003}%2C${activeReport.longitude + 0.004}%2C${activeReport.latitude + 0.003}&layer=mapnik&marker=${activeReport.latitude}%2C${activeReport.longitude}`}
                      className="w-full h-full filter contrast-125"
                    />
                  </div>
                </div>
              </div>

              {/* Road Damage Assessment Card */}
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[#F7D10C]" />
                  <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                    Verified Road Damage Details
                  </h4>
                </div>

                <p className="text-xs text-[var(--text-secondary)] leading-relaxed bg-[var(--bg-elevated)] p-3 rounded-xl border border-[var(--border-subtle)]">
                  {activeReport.ai_reasoning}
                </p>

                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] text-[10px] uppercase block">Est. Width</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">
                      ~{activeReport.estimated_diameter_cm || 25} cm
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] text-[10px] uppercase block">Hazard Status</span>
                    <span className="font-bold text-[#F7D10C] text-sm">
                      Verified Damage
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] text-[10px] uppercase block">Confirmations</span>
                    <span className="font-bold text-[var(--text-primary)] text-sm">
                      {activeReport.upvotes || 0} Citizens
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Prominent 3-Step Official Action Bar ── */}
              <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-5 shadow-sm space-y-3">
                <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  Official Municipal Dispatch Pipeline
                </h4>

                <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 select-none">
                  {/* Step 1: Acknowledge */}
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('Acknowledged')}
                    disabled={statusUpdating || activeReport.status === 'Acknowledged' || activeReport.status === 'In Progress' || activeReport.status === 'Repaired'}
                    className={`w-full sm:w-auto min-h-[48px] px-4 py-3 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                      activeReport.status === 'Acknowledged' || activeReport.status === 'In Progress' || activeReport.status === 'Repaired'
                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20 cursor-default'
                        : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                    }`}
                  >
                    <Eye size={15} />
                    <span>1. Acknowledge Docket</span>
                  </button>

                  {/* Step 2: Dispatch Repair Squad */}
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus('In Progress')}
                    disabled={statusUpdating || activeReport.status === 'In Progress' || activeReport.status === 'Repaired'}
                    className={`w-full sm:w-auto min-h-[48px] px-4 py-3 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                      activeReport.status === 'In Progress' || activeReport.status === 'Repaired'
                        ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20 cursor-default'
                        : 'bg-amber-500 text-black shadow-sm hover:brightness-105'
                    }`}
                  >
                    <Truck size={15} />
                    <span>2. Dispatch Repair Squad</span>
                  </button>

                  {/* Step 3: Upload Proof & Complete */}
                  <button
                    type="button"
                    onClick={() => setShowRepairModal(true)}
                    disabled={statusUpdating || activeReport.status === 'Repaired'}
                    className={`w-full sm:w-auto min-h-[48px] px-4 py-3 rounded-xl font-mono text-xs font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer ${
                      activeReport.status === 'Repaired'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 cursor-default'
                        : 'bg-[#F7D10C] text-[#09090b] shadow-sm hover:brightness-105'
                    }`}
                  >
                    <CheckCircle2 size={15} />
                    <span>3. Upload Proof & Complete</span>
                  </button>
                </div>
              </div>

              {/* ── Proof of Repair Modal ── */}
              {showRepairModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
                  <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-6 space-y-4 shadow-2xl animate-slide-up text-[var(--text-primary)]">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-500" />
                        <h3 className="font-mono text-sm font-bold">Close Docket & Upload Proof</h3>
                      </div>
                      <button
                        onClick={() => setShowRepairModal(false)}
                        className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)]">
                      Resolving docket <strong>INC-{activeReport.id.slice(0, 8)}</strong>. Attaching cold-asphalt proof photos will mark the SLA as satisfied.
                    </p>

                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                        Officer Resolution Note / Contractor Work Order #
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g., Cold-asphalt mix applied and steam-rolled by Ward 22 emergency squad."
                        value={repairNote}
                        onChange={(e) => setRepairNote(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                      />
                    </div>

                    <div>
                      <label className="block font-mono text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                        Repaired Road Photo Proof (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProofPhotoUpload}
                        className="w-full text-xs text-[var(--text-muted)] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-[var(--bg-elevated)] file:text-xs file:font-mono file:font-bold file:text-[var(--text-primary)] hover:file:bg-[var(--bg-elevated-hover)]"
                      />
                      {uploadingRepairPhoto && (
                        <p className="font-mono text-[11px] text-amber-500 mt-1">Uploading proof photo…</p>
                      )}
                      {repairImageUrl && (
                        <p className="font-mono text-[11px] text-emerald-500 mt-1">✓ Photo attached successfully.</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-[var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => setShowRepairModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-xs font-semibold text-[var(--text-secondary)] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={statusUpdating}
                        onClick={() =>
                          handleUpdateStatus('Repaired', {
                            note: repairNote || 'Asphalt cold-patch applied and leveled.',
                            imageUrl: repairImageUrl || undefined,
                          })
                        }
                        className="flex-1 py-2.5 rounded-xl bg-[#F7D10C] text-[#09090b] text-xs font-mono font-bold hover:brightness-105 transition shadow-sm cursor-pointer"
                      >
                        {statusUpdating ? 'Updating…' : '✓ Confirm Repaired'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[var(--text-muted)]">
              <Shield size={36} className="mb-3 opacity-30" />
              <h3 className="font-mono text-sm font-semibold text-[var(--text-secondary)]">No Incident Selected</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
                Select an incident docket from the left queue to review forensic damage evidence, GPS coordinates, and dispatch work orders.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
