'use client';
import { useState, useEffect, useRef } from 'react';
import { Camera, MapPin, MessageCircle } from 'lucide-react';
import SeverityBadge from '../components/SeverityBadge';
import { supabase } from '../lib/supabaseClient';

export default function Home() {
  const [posts, setPosts] = useState<any[]>([]);
  const [verifying, setVerifying] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('reports').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data) setPosts(data); });
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setVerifying(true);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      const url = URL.createObjectURL(f);
      const body = { imageUrl: url, latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, userId: 'anon' };
      fetch('/api/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(async r => {
          const result = await r.json();
          if (r.ok && result) { supabase.from('reports').select('*').order('created_at', { ascending: false }).then(({ data }) => { if (data) setPosts(data); }); }
          setVerifying(false);
        })
        .catch(() => setVerifying(false));
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
      {verifying && (<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center"><div className="text-center"><div className="w-12 h-12 rounded-full border-4 border-lime-400 border-t-transparent animate-spin mx-auto mb-4"></div><p className="text-sm text-zinc-300">Verifying with Gemini Vision...</p></div></div>)}
      <main className="max-w-md mx-auto px-3 py-4 space-y-6">
        {posts.map(p => (
          <article key={p.id} className="rounded-2xl overflow-hidden bg-[#121212] border border-[#27272a] shadow-2xl shadow-black/40">
            <div className="relative aspect-[4/5] bg-zinc-900"><img src={p.image_url} alt="Pothole" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1564013799919-6a3a0cb7a89d?w=600&q=80'; }} /><div className="absolute top-3 left-3"><SeverityBadge severity={p.severity?.toLowerCase() || 'medium'} /></div></div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400"><div><span className="font-semibold text-white">Citizen Reporter</span><span className="mx-1">•</span><span>Hubballi</span></div><span>{new Date(p.created_at).toLocaleString()}</span></div>
              <div className="flex items-center gap-2 text-xs text-zinc-500"><MapPin size={12}/> {p.latitude}, {p.longitude}</div>
              <p className="text-sm font-medium text-zinc-200 leading-snug">AI Confirmed: {p.ai_reasoning || 'Potential road surface damage detected.'}</p>
              <div className="flex items-center gap-2"><a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 transition text-center">Maps</a></div>
              <div className="pt-1"><span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${p.status === 'Repaired' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{p.status}</span></div>
            </div>
          </article>
        ))}
      </main>
    </div>
  );
}
