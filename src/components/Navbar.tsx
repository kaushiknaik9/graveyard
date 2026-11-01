'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import {
  Sun,
  Moon,
  Shield,
  Plus,
  LogIn,
  LogOut,
  Layers,
  Radio,
  Building2,
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { user, role, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 backdrop-blur-md px-4 sm:px-6 transition-colors">
      <div className="max-w-[1440px] mx-auto h-full flex items-center justify-between gap-4">
        {/* Brand Section */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            {/* Brand Logo from public/Logo.png */}
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border-subtle)] group-hover:scale-105 transition-transform">
              <img src="/Logo.png" alt="Forge Civic Logo" className="w-full h-full object-contain p-0.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-base sm:text-lg text-[var(--text-primary)]">
                FORGE
              </span>
              <span className="hidden sm:inline font-mono text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                ROAD SAFETY
              </span>
            </div>
          </Link>

          {/* Nav links on desktop */}
          <nav className="hidden md:flex items-center gap-1 ml-4 pl-4 border-l border-[var(--border-subtle)] text-xs font-semibold">
            <Link
              href="/"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
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
                className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
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
        <div className="flex items-center gap-2 sm:gap-3">
          {/* THEME TOGGLE BUTTON */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle Light / Dark Mode"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <>
                <Sun size={14} className="text-[#F7D10C]" />
                <span className="hidden sm:inline font-mono text-[11px]">Light</span>
              </>
            ) : (
              <>
                <Moon size={14} className="text-zinc-600" />
                <span className="hidden sm:inline font-mono text-[11px]">Dark</span>
              </>
            )}
          </button>

          {/* Quick Action Button for Mobile/Tablet - CITIZENS ONLY */}
          {role === 'citizen' && (
            <Link
              href="/#report"
              className="hidden sm:flex lg:hidden items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F7D10C] text-[#09090b] text-xs font-bold hover:brightness-105 active:scale-95 transition-all shadow-sm"
            >
              <Plus size={14} strokeWidth={3} />
              <span>Report</span>
            </Link>
          )}

          {/* User Role Pill & Auth State */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-xs font-mono">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    role === 'gov' ? 'bg-[#F7D10C]' : 'bg-blue-400'
                  }`}
                />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  {role === 'gov' ? 'GOV OFFICIAL' : 'CITIZEN'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => signOut()}
                className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/auth"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] text-xs font-semibold transition-colors"
            >
              <LogIn size={13} />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
