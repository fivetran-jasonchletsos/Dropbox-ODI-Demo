import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, X, Building2 } from 'lucide-react';
import { loadInstitutions } from '../lib/data';
import type { InstitutionRow } from '../types';
import Loading from '../components/Loading';
import Panel from '../components/Panel';
import RiskChip from '../components/RiskChip';
import * as watchlist from '../lib/watchlist';
import { fmtInt, tierColor } from '../lib/format';

export default function WatchlistPage() {
  const [all, setAll] = useState<InstitutionRow[] | null>(null);
  const [ids, setIds] = useState<string[]>(watchlist.get());

  useEffect(() => {
    loadInstitutions().then(setAll);
    const unsub = watchlist.subscribe(setIds);
    return unsub;
  }, []);

  const rows = useMemo(() => {
    if (!all) return [];
    const set = new Set(ids);
    return all.filter((i) => set.has(i.cert_id));
  }, [all, ids]);

  if (!all) return <Loading />;

  const totalDeposits = rows.reduce((a, b) => a + b.deposits_b, 0);
  const avgRisk = rows.length ? rows.reduce((a, b) => a + b.risk_score, 0) / rows.length : 0;
  const branches = rows.reduce((a, b) => a + b.branches, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">Pulse</div>
          <h1 className="font-display text-4xl font-bold mt-1 flex items-center gap-3">
            <Star className="h-7 w-7 text-amber-300" fill="currentColor" />
            Watchlist
          </h1>
          <p className="text-slate-400 text-sm mt-1">{rows.length === 0 ? 'No institutions yet — add some from the catalog.' : `Tracking ${rows.length} institution${rows.length === 1 ? '' : 's'}.`}</p>
        </div>
        {rows.length > 0 && (
          <button onClick={() => watchlist.clear()} className="text-sm text-slate-400 hover:text-rose-300 inline-flex items-center gap-1.5">
            <X className="h-3.5 w-3.5" /> Clear watchlist
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <Panel>
          <div className="text-center py-12">
            <div className="h-14 w-14 rounded-xl bg-[#002a5c] border border-[#163d6d] flex items-center justify-center mx-auto mb-4 text-slate-500">
              <Star className="h-7 w-7" />
            </div>
            <div className="text-slate-300 font-medium">No institutions in your watchlist yet.</div>
            <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
              Open the <Link className="text-[#FFCB05] hover:text-cyan-200" to="/institutions">Institutions</Link> page, pick the banks you want to monitor, and they'll appear here.
            </p>
          </div>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Stat label="Total deposits" value={`$${totalDeposits.toFixed(2)}B`} accent="cyan" />
            <Stat label="Total branches" value={fmtInt(branches)} accent="violet" />
            <Stat label="Avg risk score" value={avgRisk.toFixed(1)} accent="amber" />
          </div>

          <Panel bodyClassName="p-0">
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10.5px] uppercase tracking-[0.16em] text-slate-500 font-mono bg-[#001f44]">
                    <th className="px-3 py-3 border-b border-[#163d6d]">Institution</th>
                    <th className="px-3 py-3 border-b border-[#163d6d]">State</th>
                    <th className="px-3 py-3 border-b border-[#163d6d] text-right">Deposits $B</th>
                    <th className="px-3 py-3 border-b border-[#163d6d] text-right">Capital %</th>
                    <th className="px-3 py-3 border-b border-[#163d6d] text-right">ROA %</th>
                    <th className="px-3 py-3 border-b border-[#163d6d]">Risk</th>
                    <th className="px-3 py-3 border-b border-[#163d6d] w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.cert_id} className="table-row">
                      <td className="px-3 py-2.5">
                        <Link to={`/institutions/${r.cert_id}`} className="text-slate-100 hover:text-[#FFCB05] font-medium">{r.name}</Link>
                        <div className="text-[11px] text-slate-500">{r.city} · cert {r.cert_id}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300">{r.state}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-slate-100">{r.deposits_b.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-slate-300">{r.capital_ratio_pct.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-mono tabular text-slate-300">{r.return_on_assets_pct.toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <RiskChip tier={r.risk_tier} />
                          <div className="flex-1 max-w-[60px] h-1.5 rounded-full bg-[#163d6d] overflow-hidden">
                            <div className="h-full" style={{ width: `${r.risk_score}%`, background: tierColor(r.risk_tier) }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => watchlist.remove(r.cert_id)} className="h-7 w-7 rounded-md inline-flex items-center justify-center text-slate-500 hover:text-rose-300 hover:bg-rose-500/10" title="Remove">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: 'cyan' | 'violet' | 'amber' }) {
  const grad = {
    cyan: 'from-[#FFCB05]/25',
    violet: 'from-[#00274C]/25',
    amber: 'from-amber-400/25',
  }[accent];
  return (
    <div className="panel p-5 relative overflow-hidden">
      <div className={`absolute -top-16 -right-16 h-32 w-32 rounded-full bg-gradient-to-br ${grad} to-transparent blur-2xl pointer-events-none`} />
      <div className="eyebrow">{label}</div>
      <div className="kpi-num mt-2">{value}</div>
    </div>
  );
}
