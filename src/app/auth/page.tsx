'use client';
import { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
export default function AuthPage() {
  const [tab, setTab] = useState<'citizen' | 'gov'>('citizen');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'citizen') {
      const { error, data } = await supabase.auth.signUp({ email, password: pw, options: { data: { role: 'citizen' } } });
      setMsg(error ? error.message : 'Citizen account created. Check email.');
    } else {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password: pw });
      setMsg(error ? error.message : 'Gov login OK');
    }
  };

  return (
    <main className="min-h-screen bg-[#09090b] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-[#121212] border border-[#27272a] rounded-2xl p-6 shadow-2xl">
        <h1 className="text-2xl font-extrabold mb-1">Forge Auth</h1>
        <div className="flex gap-2 mb-4">
          <button onClick={() => setTab('citizen')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tab === 'citizen' ? 'bg-lime-400 text-black' : 'bg-zinc-800'}`}>Citizen</button>
          <button onClick={() => setTab('gov')} className={`flex-1 py-2 rounded-lg text-xs font-bold ${tab === 'gov' ? 'bg-amber-400 text-black' : 'bg-zinc-800'}`}>Gov Official</button>
        </div>
        <form onSubmit={handle} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#0f0f12] border border-[#27272a] text-sm" />
          <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-[#0f0f12] border border-[#27272a] text-sm" />
          <button type="submit" className="w-full py-3 bg-gradient-to-r from-lime-300 to-emerald-400 text-black font-extrabold rounded-xl">Continue</button>
        </form>
        {msg && <p className="text-xs text-zinc-400 mt-3">{msg}</p>}
      </div>
    </main>
  );
}
