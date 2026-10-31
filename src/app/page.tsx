'use client';
import { useState, useEffect } from 'react';
import FeedCard from '../components/FeedCard';
import { Pothole } from '../types';
import { getPotholes, addPothole } from '../lib/store';

export default function Home() {
  const [potholes, setPotholes] = useState<Pothole[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const list = getPotholes();
    if (list.length === 0) {
      const defaults: Pothole[] = [
        { id: 'p1', photoUrl: 'https://images.unsplash.com/photo-1564013799919-6a3a0cb7a89d?w=600&q=80', lat: 12.9716, lng: 77.5946, severity: 'severe', timestamp: '2026-10-30T14:32:00Z', confirmationCount: 23, status: 'pending', reportedBy: '@civic_user_42' },
        { id: 'p2', photoUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&q=80', lat: 12.9350, lng: 77.6100, severity: 'medium', timestamp: '2026-10-31T09:15:00Z', confirmationCount: 7, status: 'acknowledged', reportedBy: '@watchdog' },
        { id: 'p3', photoUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&q=80', lat: 12.9580, lng: 77.6030, severity: 'low', timestamp: '2026-10-29T22:00:00Z', confirmationCount: 2, status: 'pending', reportedBy: '@street_scout' },
      ];
      localStorage.setItem('forge_potholes', JSON.stringify(defaults));
      setPotholes(defaults);
    } else { setPotholes(list); }
  }, []);

  const [newPhoto, setNewPhoto] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [severity, setSeverity] = useState<Pothole['severity']>('medium');

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!newPhoto || !lat || !lng) return; const pothole: Pothole = { id: 'p-'+Date.now(), photoUrl: newPhoto, lat: parseFloat(lat), lng: parseFloat(lng), severity, timestamp: new Date().toISOString(), confirmationCount: 1, status: 'pending', reportedBy: 'current_user' }; addPothole(pothole); setPotholes([...getPotholes()]); setNewPhoto(''); setLat(''); setLng(''); };

  const updateStatus = (id: string, status: Pothole['status']) => { const list = getPotholes().map(x => x.id === id ? { ...x, status } : x); localStorage.setItem('forge_potholes', JSON.stringify(list)); setPotholes(list); };

  return (
    <main className="min-h-screen p-4">
      <header className="mb-8"><h1 className="text-3xl font-bold">Forge</h1><p className="text-gray-500 mt-1">Civic Pothole Monitoring & Response</p></header>
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto mb-6">
        <div className="flex gap-3">
          <input placeholder="Photo URL" value={newPhoto} onChange={e => setNewPhoto(e.target.value)} className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2" />
          <input type="number" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)} className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2" />
          <input type="number" placeholder="Longitude" value={lng} onChange={e => setLng(e.target.value)} className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2" />
          <select value={severity} onChange={e => setSeverity(e.target.value as Pothole['severity'])} className="border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2"><option value="low">Low</option><option value="medium">Medium</option><option value="severe">Severe</option></select>
        </div>
        <button type="submit" className="mt-4 w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg">Report Pothole</button>
      </form>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{potholes.map(p => <FeedCard key={p.id} pothole={p} onRepair={() => updateStatus(p.id,'repaired')} />)}</div>
    </main>
  );
}