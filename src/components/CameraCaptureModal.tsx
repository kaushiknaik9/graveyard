'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Camera,
  Upload,
  X,
  MapPin,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  RefreshCw,
  Compass,
  SlidersHorizontal,
} from 'lucide-react';
import InteractiveMapPinPicker from './InteractiveMapPinPicker';
import { haversineDistanceKm } from '../lib/jurisdictions';
import { Report } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (file: File, coords: { lat: number; lng: number; accuracy: number }, note: string) => Promise<void>;
  onBoostExisting: (existingReportId: string) => Promise<void>;
  existingReports: Report[];
}

async function compressImageFile(file: File, maxDim = 1280, quality = 0.82): Promise<File> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);

        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            const compressed = new File(
              [blob],
              file.name.replace(/\.[^.]+$/, '.jpg'),
              { type: 'image/jpeg', lastModified: Date.now() }
            );
            resolve(compressed);
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onSubmit,
  onBoostExisting,
  existingReports,
}: Props) {
  const [mode, setMode] = useState<'viewfinder' | 'upload' | 'preview'>('viewfinder');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [compressing, setCompressing] = useState(false);

  // GPS State
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'locking' | 'locked' | 'failed'>('locking');
  const [showPinPicker, setShowPinPicker] = useState(false);

  // Deduplication state
  const [nearbyDuplicate, setNearbyDuplicate] = useState<{ report: Report; distanceMeters: number } | null>(null);

  // WebRTC Video
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Acquire GPS Coordinates ──
  const acquireGps = useCallback(() => {
    setGpsStatus('locking');
    if (!navigator.geolocation) {
      setGpsStatus('failed');
      setShowPinPicker(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 8),
        });
        setGpsStatus('locked');
      },
      (err) => {
        console.warn('[Geolocation Warning]', err.message);
        setGpsStatus('failed');
        setCoords({ lat: 15.3647, lng: 75.1240, accuracy: 50 });
        setShowPinPicker(true);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, []);

  // ── Start Live WebRTC Viewfinder ──
  const startCamera = useCallback(async () => {
    try {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 } },
        audio: false,
      });

      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setMode('viewfinder');
    } catch {
      setMode('upload');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      acquireGps();
      startCamera();
    } else {
      stopCamera();
      setSelectedFile(null);
      setPreviewUrl(null);
      setNote('');
      setNearbyDuplicate(null);
      setShowPinPicker(false);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, acquireGps, startCamera, stopCamera]);

  useEffect(() => {
    if (!coords || !existingReports || existingReports.length === 0) {
      setNearbyDuplicate(null);
      return;
    }

    let closest: { report: Report; distanceMeters: number } | null = null;
    let minMeters = Infinity;

    for (const r of existingReports) {
      if (r.status === 'Repaired') continue;
      const distM = haversineDistanceKm(coords.lat, coords.lng, r.latitude, r.longitude) * 1000;
      if (distM <= 25 && distM < minMeters) {
        minMeters = distM;
        closest = { report: r, distanceMeters: Math.round(distM) };
      }
    }

    setNearbyDuplicate(closest);
  }, [coords, existingReports]);

  const handleShutterSnap = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const rawFile = new File([blob], `snap-${Date.now()}.jpg`, { type: 'image/jpeg' });
      setCompressing(true);
      const compressed = await compressImageFile(rawFile);
      setSelectedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
      setCompressing(false);
      setMode('preview');
      stopCamera();
    }, 'image/jpeg', 0.85);
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCompressing(true);
    const compressed = await compressImageFile(file);
    setSelectedFile(compressed);
    setPreviewUrl(URL.createObjectURL(compressed));
    setCompressing(false);
    setMode('preview');
    stopCamera();
  };

  const handlePublish = async () => {
    if (!selectedFile || !coords) return;
    await onSubmit(selectedFile, coords, note);
  };

  const handleBoost = async () => {
    if (!nearbyDuplicate) return;
    await onBoostExisting(nearbyDuplicate.report.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in">
      <div className="relative w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#F7D10C] flex items-center justify-center text-black font-bold">
              <Camera size={16} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Capture Road Hazard</h3>
              <p className="font-mono text-[10px] text-[var(--text-secondary)]">Live GPS Location • Routed to Nearest Municipal Office</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* GPS Accuracy Ribbon */}
        <div className="px-4 py-2 bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                gpsStatus === 'locked'
                  ? 'bg-[#F7D10C]'
                  : gpsStatus === 'locking'
                  ? 'bg-amber-400 animate-ping'
                  : 'bg-red-400'
              }`}
            />
            <span className="text-[var(--text-primary)] font-semibold">
              {gpsStatus === 'locked' && coords
                ? `GPS Locked: ±${coords.accuracy}m accuracy`
                : gpsStatus === 'locking'
                ? 'Acquiring high-accuracy GPS lock...'
                : 'GPS timed out — manual pin required'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowPinPicker(!showPinPicker)}
            className="text-[11px] font-semibold text-[#F7D10C] hover:underline flex items-center gap-1 transition cursor-pointer"
          >
            <SlidersHorizontal size={12} />
            {showPinPicker ? 'Hide Pin Picker' : 'Adjust Pin'}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {showPinPicker && coords && (
            <div className="animate-slide-up">
              <InteractiveMapPinPicker
                initialLat={coords.lat}
                initialLng={coords.lng}
                onSelectCoords={(lat, lng) => setCoords({ lat, lng, accuracy: 5 })}
                onClose={() => setShowPinPicker(false)}
              />
            </div>
          )}

          {/* Spatial Duplicate Warning */}
          {nearbyDuplicate && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[var(--text-primary)] animate-slide-up">
              <div className="flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-amber-500 font-mono">
                    Nearby Hazard Detected ({nearbyDuplicate.distanceMeters}m away)
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-1">
                    An unresolved hazard exists at this location. Confirming raises its dispatch priority score.
                  </p>
                  <div className="flex gap-2 mt-2.5">
                    <button
                      type="button"
                      onClick={handleBoost}
                      className="px-3 py-1.5 rounded-lg bg-[#F7D10C] text-black text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <ThumbsUp size={12} className="fill-black" />
                      +1 Boost Existing Hazard
                    </button>
                    <button
                      type="button"
                      onClick={() => setNearbyDuplicate(null)}
                      className="px-3 py-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-xs font-medium transition cursor-pointer"
                    >
                      Post as New
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Camera Viewfinder */}
          {mode === 'viewfinder' && (
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black border border-[var(--border-subtle)] shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Viewfinder Grid */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-20 border border-white/20">
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-r border-b border-white/20" />
                <div className="border-b border-white/20" />
                <div className="border-r border-white/20" />
                <div className="border-r border-white/20" />
                <div />
              </div>

              {/* Shutter Bar */}
              <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-6 px-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center border border-white/20 hover:bg-zinc-800 transition cursor-pointer"
                  title="Upload from Gallery"
                >
                  <Upload size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleShutterSnap}
                  className="w-16 h-16 rounded-full border-4 border-white bg-[#F7D10C] hover:brightness-105 active:scale-95 transition flex items-center justify-center shadow-xl cursor-pointer"
                  title="Capture Shutter"
                >
                  <div className="w-12 h-12 rounded-full border-2 border-black" />
                </button>

                <button
                  type="button"
                  onClick={startCamera}
                  className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-md text-white flex items-center justify-center border border-white/20 hover:bg-zinc-800 transition cursor-pointer"
                  title="Reset Camera"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[var(--border-strong)] hover:border-[#F7D10C] rounded-xl p-8 text-center cursor-pointer bg-[var(--bg-elevated)] transition group"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--bg-surface)] text-[var(--text-secondary)] group-hover:text-[#F7D10C] flex items-center justify-center mx-auto mb-3 transition">
                <Upload size={22} />
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Tap to upload road hazard photo</p>
              <p className="font-mono text-xs text-[var(--text-muted)] mt-1">JPG, PNG, WebP (auto-compressed to 1280px)</p>
            </div>
          )}

          {mode === 'preview' && previewUrl && (
            <div className="space-y-3 animate-fade-in">
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-black border border-[var(--border-subtle)]">
                <img
                  src={previewUrl}
                  alt="Captured Hazard"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl(null);
                    setMode('viewfinder');
                    startCamera();
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur text-xs font-semibold text-white border border-white/20 transition cursor-pointer"
                >
                  Retake Photo
                </button>
              </div>

              <div>
                <label className="block font-mono text-[11px] font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">
                  Citizen Context Note (Optional)
                </label>
                <input
                  type="text"
                  maxLength={160}
                  placeholder="e.g., Deep asphalt fissure near bus stop, risk for two-wheelers"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#F7D10C]"
                />
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] text-xs font-semibold transition cursor-pointer"
          >
            Cancel
          </button>

          {mode === 'preview' && selectedFile ? (
            <button
              type="button"
              disabled={compressing || !coords}
              onClick={handlePublish}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[#F7D10C] hover:brightness-105 active:scale-95 text-[#09090b] text-xs font-bold font-mono flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50 cursor-pointer"
            >
              <Sparkles size={14} />
              Publish Verified Alert
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Upload size={14} />
              Choose from Gallery / Camera
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
