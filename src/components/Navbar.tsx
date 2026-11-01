'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Sun,
  Moon,
  Building2,
  LogOut,
  LogIn,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 h-14 sm:h-16 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 backdrop-blur-xl px-3 sm:px-6 transition-colors select-none">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between gap-3">
        {/* Brand Section */}
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2 group active:scale-95 transition-transform">
            {/* Brand Logo from public/Logo.png */}
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] group-hover:scale-105 transition-transform shrink-0">
              <img src="/Logo.png" alt="Forge Logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold tracking-tight text-base sm:text-lg text-[var(--text-primary)]">
                FORGE
              </span>
              <span className="hidden sm:inline font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                ROAD SAFETY
              </span>
              {/* Live Signal Indicator Dot */}
              <span className="relative flex h-2 w-2 ml-0.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-[var(--border-subtle)] text-xs font-semibold">
            <Link
              href="/"
              className={`px-3 py-2 rounded-lg transition-colors ${
                pathname === '/'
                  ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Citizen Feed
            </Link>
            {role === 'gov' && (
              <Link
                href="/gov"
                className={`px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors ${
                  pathname === '/gov'
                    ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Building2 size={13} className="text-[#F7D10C]" />
                <span>Municipal Dashboard</span>
              </Link>
            )}
          </nav>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* THEME TOGGLE BUTTON - 44px touch target on mobile */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Light / Dark Mode"
            className="w-10 h-10 sm:w-auto sm:px-3 sm:h-9 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-95 transition-all cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={15} className="text-[#F7D10C]" />
                <span className="hidden sm:inline font-mono text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon size={15} className="text-zinc-600" />
                <span className="hidden sm:inline font-mono text-[11px]">Dark</span>
              </>
            )}
          </button>

          {/* User Role Badge & Sign Out */}
          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs font-mono max-w-[120px] sm:max-w-none truncate">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    role === 'gov' ? 'bg-[#F7D10C]' : 'bg-blue-400'
                  }`}
                />
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)] truncate">
                  {role === 'gov' ? 'OFFICIAL' : 'CITIZEN'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] active:scale-95 transition-all cursor-pointer"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="h-10 px-3.5 rounded-xl flex items-center gap-1.5 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] text-xs font-semibold active:scale-95 transition-all"
            >
              <LogIn size={14} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
