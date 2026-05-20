import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search, Star, X, Filter, Plus, Check } from 'lucide-react';
import { loadInstitutions } from '../lib/data';
import type { InstitutionRow, RiskTier, CharterClass, AssetClass } from '../types';
import Loading from '../components/Loading';
import RiskChip from '../components/RiskChip';
import * as watchlist from '../lib/watchlist';
import { fmtInt, tierColor } from '../lib/format';
import clsx from 'clsx';

const TIERS: RiskTier[] = ['low', 'watch', 'elevated', 'high'];
const CHARTERS: CharterClass[] = ['N', 'NM', 'SM', 'SB', 'SA'];
const ASSET_CLASSES: AssetClass[] = ['<100M','100M-1B','1B-10B','10B-100B','>100B'];

type SortKey = 'name' | 'state' | 'deposits_b' | 'branches' | 'risk_score' | 'capital_ratio_pct' | 'return_on_assets_pct';

export default function InstitutionsPage() {
  const [data, setData] = useState<InstitutionRow[] | null>(null);
  const [search] = useSearchParams();
  const [q, setQ] = useState(search.get('q') ?? '');
  const [state, setState] = useState<string>('');
  const [charter, setCharter] = useState<string>('');
  const [assetClass, setAssetClass] = useState<string>('');
  const [tier, setTier] = useState<string>('');
  const [sortKey, setSortKey] = useState<SortKey>('deposits_b');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);

  useEffect(() => {
    loadInstitutions().then(setData);
    const unsub = watchlist.subscribe(() => setTick((t) => t + 1));
    return unsub;
  }, []);

  const states = useMemo(() => Array.from(new Set((data ?? []).map((d) => d.state))).sort(), [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.filter((r) => {
      if (needle && !`${r.name} ${r.city} ${r.state} ${r.cert_id}`.toLowerCase().includes(needle)) return false;
      if (state && r.state !== state) return false;
      if (charter && r.charter_class !== charter) return false;
      if (assetClass && r.asset_class !== assetClass) return false;
      if (tier && r.risk_tier !== tier) return false;
      return true;
    });
  }, [data, q, state, charter, assetClass, tier]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const va = a[sortKey] as number | string;
      const vb = b[sortKey] as number | string;
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir(k === 'name' || k === 'state' ? 'asc' : 'desc'); }
  }

  function clearFilters() {
    setQ(''); setState(''); setCharter(''); setAssetClass(''); setTier('');
  }

  function toggleSelect(id: string) {
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }

  function addSelectedToWatchlist() {
    selected.forEach((id) => watchlist.add(id));
    setSelected(new Set());
  }

  const hasFilters = q || state || charter || assetClass || tier;

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Pulse</div>
          <h1 className="font-display text-4xl font-bold mt-1">Institutions</h1>
          <div className="text-slate-400 text-sm mt-1">
            <span className="font-mono tabular text-slate-200">{fmtInt(sorted.length)}</span> of <span className="font-mono tabular text-slate-200">{fmtInt(data.length)}</span> institutions
          </div>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-400">{selected.size} selected</span>
            <button
              onClick={addSelectedToWatchlist}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FFCB05]/15 text-cyan-200 border border-[#FFCB05]/30 hover:bg-[#FFCB05]/25 text-sm font-medium"
            >
              <Star className="h-4 w-4" /> Add to watchlist
            </button>
          </div>
        )}
      </div>

      <div className="panel p-4">
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, city, state, cert…"
              className="w-full rounded-lg bg-[#001f44] border border-[#163d6d] pl-10 pr-3 py-2 text-sm placeholder:text-slate-500 focus:border-[#FFCB05]/60 focus:outline-none"
            />
          </div>
          <Select label="State" value={state} onChange={setState} options={states} />
          <Select label="Charter" value={charter} onChange={setCharter} options={CHARTERS} />
          <Select label="Asset class" value={assetClass} onChange={setAssetClass} options={ASSET_CLASSES} />
          <Select label="Risk tier" value={tier} onChange={setTier} options={TIERS} />
        </div>
        {hasFilters && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <Filter className="h-3 w-3 text-[#FFCB05]" />
            <span className="text-slate-400">Filters active</span>
            <button onClick={clearFilters} className="ml-2 text-[#FFCB05] hover:text-cyan-200 inline-flex items-center gap-1">
              Clear <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto scroll-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.16em] text-slate-500 font-mono bg-[#001f44] sticky top-0 z-10">
                <Th className="w-8">{' '}</Th>
                <Th onClick={() => toggleSort('name')} sortable active={sortKey==='name'} dir={sortDir}>Institution</Th>
                <Th onClick={() => toggleSort('state')} sortable active={sortKey==='state'} dir={sortDir}>State</Th>
                <Th>Charter</Th>
                <Th>Asset</Th>
                <Th onClick={() => toggleSort('deposits_b')} sortable active={sortKey==='deposits_b'} dir={sortDir} right>Deposits $B</Th>
                <Th onClick={() => toggleSort('branches')} sortable active={sortKey==='branches'} dir={sortDir} right>Branches</Th>
                <Th onClick={() => toggleSort('capital_ratio_pct')} sortable active={sortKey==='capital_ratio_pct'} dir={sortDir} right>Capital %</Th>
                <Th onClick={() => toggleSort('return_on_assets_pct')} sortable active={sortKey==='return_on_assets_pct'} dir={sortDir} right>ROA %</Th>
                <Th onClick={() => toggleSort('risk_score')} sortable active={sortKey==='risk_score'} dir={sortDir}>Risk</Th>
                <Th className="w-8">{' '}</Th>
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, 250).map((r) => {
                const isSelected = selected.has(r.cert_id);
                const isWatched = watchlist.has(r.cert_id);
                return (
                  <tr key={r.cert_id} className="table-row">
                    <td className="px-3 py-2.5 align-middle">
                      <button
                        onClick={() => toggleSelect(r.cert_id)}
                        className={clsx(
                          'h-4 w-4 rounded border flex items-center justify-center transition-colors',
                          isSelected ? 'bg-[#FFCB05] border-[#FFCB05] text-[#00152e]' : 'border-slate-600 hover:border-[#FFCB05]'
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <Link to={`/institutions/${r.cert_id}`} className="text-slate-100 hover:text-[#FFCB05] font-medium">
                        {r.name}
                      </Link>
                      <div className="text-[11px] text-slate-500">{r.city} · cert {r.cert_id} · est. {r.established_year}</div>
                    </td>
                    <td className="px-3 py-2.5 align-middle font-mono tabular text-slate-300">{r.state}</td>
                    <td className="px-3 py-2.5 align-middle text-slate-400 font-mono text-xs">{r.charter_class}</td>
                    <td className="px-3 py-2.5 align-middle text-slate-400 font-mono text-xs">{r.asset_class}</td>
                    <td className="px-3 py-2.5 align-middle text-right font-mono tabular text-slate-100">{r.deposits_b.toFixed(2)}</td>
                    <td className="px-3 py-2.5 align-middle text-right font-mono tabular text-slate-300">{fmtInt(r.branches)}</td>
                    <td className="px-3 py-2.5 align-middle text-right font-mono tabular text-slate-300">{r.capital_ratio_pct.toFixed(2)}</td>
                    <td className={clsx('px-3 py-2.5 align-middle text-right font-mono tabular', r.return_on_assets_pct >= 0 ? 'text-[#FFCB05]' : 'text-rose-300')}>
                      {r.return_on_assets_pct.toFixed(2)}
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2">
                        <RiskChip tier={r.risk_tier} />
                        <div className="flex-1 max-w-[60px] h-1.5 rounded-full bg-[#163d6d] overflow-hidden">
                          <div className="h-full" style={{ width: `${r.risk_score}%`, background: tierColor(r.risk_tier) }} />
                        </div>
                        <span className="font-mono text-[11px] tabular text-slate-400">{r.risk_score}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 align-middle">
                      <button
                        onClick={() => watchlist.toggle(r.cert_id)}
                        className={clsx(
                          'h-7 w-7 rounded-md inline-flex items-center justify-center transition-colors',
                          isWatched ? 'text-amber-300 bg-amber-300/10' : 'text-slate-500 hover:text-amber-300 hover:bg-[#002a5c]'
                        )}
                        title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                      >
                        <Star className="h-4 w-4" fill={isWatched ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sorted.length > 250 && (
          <div className="px-4 py-3 border-t border-[#163d6d] text-xs text-slate-400 text-center">
            Showing first 250 of {fmtInt(sorted.length)} matches — refine filters above.
          </div>
        )}
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-2 px-1 bg-[#00152e] text-[10px] font-mono uppercase tracking-[0.16em] text-slate-500">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-[#001f44] border border-[#163d6d] px-3 py-2 text-sm text-slate-200 focus:border-[#FFCB05]/60 focus:outline-none appearance-none cursor-pointer"
      >
        <option value="">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function Th({ children, onClick, sortable, active, dir, right, className }: { children: React.ReactNode; onClick?: () => void; sortable?: boolean; active?: boolean; dir?: 'asc' | 'desc'; right?: boolean; className?: string }) {
  return (
    <th
      onClick={onClick}
      className={clsx(
        'px-3 py-3 border-b border-[#163d6d] font-semibold',
        sortable && 'cursor-pointer select-none hover:text-slate-300',
        right && 'text-right',
        active && 'text-[#FFCB05]',
        className
      )}
    >
      <span className={clsx('inline-flex items-center gap-1', right && 'flex-row-reverse')}>
        {children}
        {sortable && <ArrowUpDown className={clsx('h-3 w-3 opacity-50', active && 'opacity-100')} />}
      </span>
    </th>
  );
}
