'use client';
import { useState, useEffect } from 'react';
import { Pothole } from '../../types';
import SeverityBadge from '../../components/SeverityBadge';
import { Search } from 'lucide-react';

export default function GovPage() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => { try { const s = localStorage.getItem('forge_potholes'); if (s) setPotholes(JSON.parse(s)); } catch {} }, []);

  const updateStatus = (id: string, status: Pothole['status']) => { const updated = potholes.map(x => x.id === id ? { ...x, status } : x); setPotholes(updated); localStorage.setItem('forge_potholes', JSON.stringify(updated)); };

  const filtered = potholes.filter(p => p.id.includes(query) || p.severity.includes(query.toLowerCase()) || p.lat.toString().includes(query) || p.lng.toString().includes(query));
  const active = potholes.find(p => p.id === selected);
  const statuses: Pothole['status'][] = ['pending', 'acknowledged', 'repaired'];

  return (
    <div className="min-h-screen bg-[#09090b] text-white font-sans flex flex-col md:flex-row">
      <aside className="w-full md:w-80 md:border-r md:border-[#27272a] bg-[#0f0f12] md:fixed md:h-screen overflow-y-auto z-10">
        <div className="p-4 border-b border-[#27272a]"><h2 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-lime-300 to-emerald-400 bg-clip-text text-transparent">Government Inbox</h2>
          <div className="mt-3 relative"><Search size={14} className="absolute left-3 top-2.5 text-zinc-500" /><input type="text" placeholder="Search coordinates or severity" value={query} onChange={e => setQuery(e.target.value)} className="w-full bg-[#121212] border border-[#27272a] rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-lime-400/40" /></div>
        </div>
        <div className="divide-y divide-[#27272a]">{filtered.map(p => (
          <button key={p.id} onClick={() => setSelected(p.id)} className={`w-full text-left px-4 py-3 hover:bg-[#18181b] transition flex gap-3 items-start ${selected === p.id ? 'bg-[#18181b]' : ''}`}>
            <img src={p.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover flex-shrink-0 bg-zinc-800" onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1564013799919-6a3a0cb7a89d?w=600&q=80'; }} />
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><SeverityBadge severity={p.severity} /><span className={`w-2 h-2 rounded-full ${p.status === 'pending' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span></div><h3 className="text-sm font-semibold truncate">{p.severity.toUpperCase()} Hazard — {p.lat.toFixed(4)}, {p.lng.toFixed(4)}</h3><p className="text-[11px] text-zinc-500">AI Confidence 94% • 10m ago</p></div>
          </button>
        ))}</div>
      </aside>
      <main className="flex-1 md:ml-80 min-h-screen p-6"><div className="max-w-2xl mx-auto space-y-6">{active ? (
        <><div className="flex items-center justify-between"><h2 className="text-2xl font-extrabold">Incident {active.id}</h2><SeverityBadge severity={active.severity} /></div>
        <div className="rounded-2xl overflow-hidden border border-[#27272a] bg-[#121212] shadow-2xl"><img src={active.photoUrl} alt="" className="w-full aspect-video object-cover" onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1564013799919-6a3a0cb7a89d?w=600&q=80'; }} /><iframe title="map" width="100%" height="320" frameBorder="0" src={`https://www.openstreetmap.org/export/embed.html?bbox=${active.lng-0.005},${active.lat-0.005},${active.lng+0.005},${active.lat+0.005}&layer=mapnik&marker=${active.lat},${active.lng}`}></iframe></div>
        <div className="grid grid-cols-2 gap-3 text-xs text-zinc-300"><div className="bg-[#121212] border border-[#27272a] rounded-xl p-3">Lat: {active.lat.toFixed(4)}</div><div className="bg-[#121212] border border-[#27272a] rounded-xl p-3">Lng: {active.lng.toFixed(4)}</div></div>
        <div className="flex gap-2">{statuses.map(st => <button key={st} onClick={() => updateStatus(active.id, st)} className={`flex-1 py-3 rounded-xl text-xs font-bold uppercase tracking-wide transition border ${st === 'pending' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : st === 'acknowledged' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>{st === 'pending' ? 'Acknowledge' : st === 'acknowledged' ? 'Dispatch Repair' : 'Mark Repaired'}</button>)}</div>
        <a href={`https://www.google.com/maps?q=${active.lat},${active.lng}`} target="_blank" rel="noopener noreferrer" className="block text-center py-3 rounded-xl text-xs font-bold bg-white text-black">Open in Google Maps</a></>
      ) : <div className="text-zinc-500 text-sm">Select an incident to inspect.</div>}</div></main>
    </div>
  );
}