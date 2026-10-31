'use client';

import { useAuth } from '@/context/AuthContext';
import { LogOut, Shield, User, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export default function Navbar() {
  const { user, role, signOut, loading } = useAuth();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Don't render on the auth page
  if (pathname === '/auth') return null;

  return (
    <nav className="sticky top-0 z-50 glass border-b border-[#27272a]/60">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-lime-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-lime-400/20 group-hover:scale-105 transition">
            <Shield size={16} className="text-black" />
          </div>
          <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-lime-300 to-emerald-400 bg-clip-text text-transparent">
            Forge Civic
          </span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/"
            className={`text-sm font-medium transition ${pathname === '/' ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
          >
            Feed
          </Link>
          {role === 'gov' && (
            <Link
              href="/gov"
              className={`text-sm font-medium transition ${pathname === '/gov' ? 'text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              Gov Inbox
            </Link>
          )}

          {!loading && user ? (
            <div className="flex items-center gap-3 ml-2">
              {/* Role Badge */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${
                role === 'gov'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {role === 'gov' ? <Shield size={10} /> : <User size={10} />}
                {role === 'gov' ? 'Gov Authority' : 'Citizen'}
              </span>

              {/* User Info */}
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300 border border-zinc-600">
                  {(user.email?.[0] || 'U').toUpperCase()}
                </div>
                <span className="text-xs text-zinc-400 max-w-[120px] truncate hidden lg:block">
                  {user.email}
                </span>
              </div>

              {/* Sign Out */}
              <button
                onClick={signOut}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition border border-transparent hover:border-zinc-700"
              >
                <LogOut size={13} />
                Sign Out
              </button>
            </div>
          ) : !loading ? (
            <Link
              href="/auth"
              className="ml-2 px-4 py-2 rounded-lg bg-gradient-to-r from-lime-400 to-emerald-500 text-black text-xs font-bold hover:scale-105 transition shadow-lg shadow-lime-400/20"
            >
              Sign In
            </Link>
          ) : null}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          className="md:hidden p-2 text-zinc-400 hover:text-white transition"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="md:hidden glass border-t border-[#27272a]/60 animate-slide-up">
          <div className="px-4 py-3 space-y-3">
            <Link href="/" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-white transition">
              Feed
            </Link>
            {role === 'gov' && (
              <Link href="/gov" onClick={() => setMenuOpen(false)} className="block text-sm font-medium text-zinc-300 hover:text-white transition">
                Gov Inbox
              </Link>
            )}
            {user ? (
              <>
                <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-[11px] font-bold text-zinc-300 border border-zinc-600">
                    {(user.email?.[0] || 'U').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white truncate">{user.email}</p>
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                      {role === 'gov' ? 'Gov Authority' : 'Citizen'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { signOut(); setMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition"
                >
                  <LogOut size={13} />
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                href="/auth"
                onClick={() => setMenuOpen(false)}
                className="block text-center py-2.5 rounded-lg bg-gradient-to-r from-lime-400 to-emerald-500 text-black text-xs font-bold"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
