import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, Building2, FolderTree, Home, Map as MapIcon,
  Network, Search, Shield, Star, Menu, X, Info,
} from 'lucide-react';
import clsx from 'clsx';
import * as watchlist from '../lib/watchlist';
import TecmoBowl from './TecmoBowl';

const NAV: { to: string; label: string; icon: React.ComponentType<{ className?: string }>; group?: string }[] = [
  { to: '/', label: 'Overview', icon: Home, group: 'Pulse' },
  { to: '/institutions', label: 'Institutions', icon: Building2, group: 'Pulse' },
  { to: '/states', label: 'State Risk Map', icon: MapIcon, group: 'Pulse' },
  { to: '/watchlist', label: 'Watchlist', icon: Star, group: 'Pulse' },
  { to: '/catalog', label: 'File Catalog', icon: FolderTree, group: 'ODI' },
  { to: '/pipeline', label: 'Pipeline', icon: Activity, group: 'ODI' },
  { to: '/architecture', label: 'Architecture', icon: Network, group: 'ODI' },
  { to: '/about', label: 'About', icon: Info, group: 'ODI' },
];

const KONAMI = [
  'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
  'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
  'b', 'a',
];

export default function Layout() {
  const loc = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [watchCount, setWatchCount] = useState(watchlist.get().length);
  const [tecmoOpen, setTecmoOpen] = useState(false);
  const konamiBufferRef = useRef<string[]>([]);

  useEffect(() => {
    const unsub = watchlist.subscribe((ids) => setWatchCount(ids.length));
    return unsub;
  }, []);

  useEffect(() => { setOpen(false); }, [loc.pathname]);

  // Konami code: ↑ ↑ ↓ ↓ ← → ← → B A — unlocks Tecmo Bowl easter egg.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tecmoOpen) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      const buf = konamiBufferRef.current;
      buf.push(key);
      if (buf.length > KONAMI.length) buf.shift();
      if (buf.length === KONAMI.length && KONAMI.every((k, i) => k === buf[i])) {
        konamiBufferRef.current = [];
        setTecmoOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tecmoOpen]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/institutions?q=${encodeURIComponent(q)}` : '/institutions');
  };

  const groups = Array.from(new Set(NAV.map((n) => n.group ?? '')));

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#0d1117]/88 border-b border-[#253047]">
        <div className="flex h-16 items-center px-4 lg:px-8 gap-4">
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <SentinelMark className="h-9 w-9" />
            <div className="leading-tight">
              <div className="font-display text-[18px] font-semibold tracking-tight text-white" style={{ fontOpticalSizing: 'auto' }}>
                Sentinel
              </div>
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#7a90b0] font-mono">
                US Bank Risk Watch
              </div>
            </div>
          </Link>

          <form onSubmit={onSubmit} className="hidden md:flex flex-1 max-w-xl relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#7a90b0]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search institutions, certs, cities…"
              className="w-full rounded-lg bg-[#111827] border border-[#253047] pl-10 pr-3 py-2 text-sm placeholder:text-slate-600 focus:border-[#0061FF]/70 focus:outline-none focus:bg-[#161d2a]"
            />
            <kbd className="hidden lg:inline absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#7a90b0]/70 border border-[#253047] rounded px-1.5 py-0.5">/</kbd>
          </form>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#7a90b0]">
              <span>Built on Fivetran ODI</span>
              <span className="text-[#253047]">·</span>
              <span className="text-[#4d8fff]">dbt labs</span>
            </div>
            <button
              onClick={() => setOpen((o) => !o)}
              className="lg:hidden h-9 w-9 inline-flex items-center justify-center rounded-md border border-[#253047] text-slate-300 hover:bg-[#161d2a]"
              aria-label="Toggle menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className="h-px accent-grad opacity-70" />
      </header>

      <div className="flex-1 flex">
        <aside
          className={clsx(
            'fixed lg:sticky top-16 z-20 lg:z-10 h-[calc(100vh-65px)] w-64 shrink-0 overflow-y-auto scroll-thin border-r border-[#253047] bg-[#0d1117]/95 backdrop-blur transition-transform',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          )}
        >
          <nav className="px-3 py-5 space-y-6">
            {groups.map((g) => (
              <div key={g}>
                <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a90b0] font-mono">{g}</div>
                <div className="space-y-0.5">
                  {NAV.filter((n) => (n.group ?? '') === g).map(({ to, label, icon: Icon }) => (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === '/'}
                      className={({ isActive }) =>
                        clsx(
                          'relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors',
                          isActive
                            ? 'text-white bg-[#1e2a3d]'
                            : 'text-slate-400 hover:text-white hover:bg-[#161d2a]'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r accent-grad" />
                          )}
                          <Icon className={clsx('h-4 w-4 shrink-0', isActive ? 'text-[#4d8fff]' : '')} />
                          <span className="flex-1">{label}</span>
                          {to === '/watchlist' && watchCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 rounded-full bg-[#0061FF]/20 text-[#4d8fff] border border-[#0061FF]/40">
                              {watchCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="px-3 pt-2 border-t border-[#253047]">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a90b0] mb-2 mt-3 font-mono">Status</div>
              <div className="space-y-2 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />Bronze · OK</div>
                <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />Silver · OK</div>
                <div className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />Gold · OK</div>
              </div>
            </div>
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 lg:py-10">
            <Outlet />
          </div>
          <footer className="border-t border-[#253047] mt-12">
            <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between text-[11px] text-[#7a90b0]">
              <div className="flex items-center gap-3">
                <Shield className="h-3.5 w-3.5 text-[#4d8fff]/80" />
                <span>Sentinel · Synthetic FDIC data · For ODI architecture demonstration only.</span>
              </div>
              <div className="font-mono">Fivetran <span className="text-[#253047]">·</span> dbt labs <span className="text-[#253047]">·</span> Iceberg <span className="text-[#253047]">·</span> Snowflake</div>
            </div>
          </footer>
        </main>
      </div>

      {tecmoOpen && <TecmoBowl onClose={() => setTecmoOpen(false)} />}
    </div>
  );
}

export function SentinelMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" aria-hidden>
      <defs>
        <linearGradient id="sentinel-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0061FF" />
          <stop offset="55%" stopColor="#4d8fff" />
          <stop offset="100%" stopColor="#00c9b1" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="#1e2a3d" stroke="#253047" />
      <path d="M16 5 L26 9 V16 C26 22 21.5 26 16 27 C10.5 26 6 22 6 16 V9 Z" fill="none" stroke="url(#sentinel-grad)" strokeWidth="1.6" strokeLinejoin="round" />
      <circle cx="16" cy="15" r="2.4" fill="#0061FF" />
      <path d="M16 17.5 V21.5" stroke="#4d8fff" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
