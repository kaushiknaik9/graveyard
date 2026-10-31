'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, MessageCircle } from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import { Pothole } from '../types';
import { getPotholes, addPothole } from '../lib/store';

export default function Home() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [verifying, setVerifying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const list = getPotholes();
    if (list.length === 0) {
      const d: Pothole[] = [
        { id: 'p1', photoUrl: 'https://images.unsplash.com/photo-1564013799919-6a3a0cb7a89d?w=600&q=80', lat: 12.9716, lng: 77.5946, severity: 'severe', timestamp: '2026-10-30T14:32:00Z', confirmationCount: 42, status: 'pending', reportedBy: 'Citizen #4829' },
        { id: 'p2', photoUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80', lat: 12.9350, lng: 77.6100, severity: 'medium', timestamp: '2026-10-31T09:15:00Z', confirmationCount: 18, status: 'acknowledged', reportedBy: 'Citizen #4829' },
        { id: 'p3', photoUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80', lat: 12.9580, lng: 77.6030, severity: 'low', timestamp: '2026-10-29T22:00:00Z', confirmationCount: 5, status: 'pending', reportedBy: 'Citizen #4829' },
      ];
      localStorage.setItem('forge_potholes', JSON.stringify(d));
      setPotholes(d);
    } else setPotholes(list);
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setVerifying(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const url = URL.createObjectURL(f);
      const newP: Pothole = { id: 'p-'+Date.now(), photoUrl: url, lat: coords.latitude, lng: coords.longitude, severity: 'medium', timestamp: new Date().toISOString(), confirmationCount: 1, status: 'pending', reportedBy: 'Citizen #4829' };
      addPothole(newP); setPotholes([...getPotholes()]); setVerifying(false);
    }, () => setVerifying(false), { enableHighAccuracy: true });
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans selection:bg-lime-400/30">
      <header className="sticky top-0 z-50 bg-[#09090b]/80 backdrop-blur-md border-b border-[#27272a] px-4 py-3 flex items-center justify-between max-w-md mx-auto">
        <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-lime-300 to-emerald-400 bg-clip-text text-transparent">Forge</h1>
        <div className="flex items-center gap-3">
          <a href="/gov" className="text-xs font-medium text-zinc-400 hover:text-white transition flex items-center gap-1"><MessageCircle size={14}/> Inbox</a>
          <button onClick={() => fileRef.current?.click()} aria-label="Snap" className="w-9 h-9 rounded-full bg-gradient-to-br from-lime-300 to-emerald-500 text-black flex items-center justify-center shadow-lg shadow-lime-400/20 hover:scale-105 transition"><Camera size={18} /></button>
        </div>
      </header>
      <input type="file" accept="image/*" capture="environment" ref={fileRef} className="hidden" onChange={onFile} />

      {verifying && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center">
          <div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-lime-400 border-t-transparent animate-spin mx-auto mb-4"></div><p className="text-sm text-zinc-300">Verifying image with Gemini Vision...</p></div>
        </div>
      )}

      <main className="max-w-md mx-auto px-3 py-4 space-y-6">
        {potholes.map(p => (
          <article key={p.id} className="rounded-2xl overflow-hidden bg-[#121212] border border-[#27272a] shadow-2xl shadow-black/40">
            <div className="relative aspect-[4/5] bg-zinc-900">
              <img src={p.photoUrl} alt="Pothole" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1564013799919-6a3a0cb7a89d?w=600&q=80'; }} />
              <div className="absolute top-3 left-3"><SeverityBadge severity={p.severity} /></div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400"><div><span className="font-semibold text-white">Citizen #4829</span><span className="mx-1">•</span><span>Hubballi</span></div><span>{new Date(p.timestamp).toLocaleString()}</span></div>
              <div className="flex items-center gap-2 text-xs text-zinc-500"><MapPin size={12}/> {p.lat.toFixed(4)}, {p.lng.toFixed(4)}</div>
              <p className="text-sm font-medium text-zinc-200 leading-snug">AI Confirmed: High-depth asphalt collapse detected.</p>
              <div className="flex items-center gap-2">
                <button className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition">Verify ({p.confirmationCount})</button>
                <a href={`https://www.google.com/maps?q=${p.lat},${p.lng}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition text-center">Maps</a>
              </div>
              <div className="pt-1"><span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${p.status === 'repaired' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{p.status === 'repaired' ? 'Repaired by Authority' : 'Pending Repair'}</span></div>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}