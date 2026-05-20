import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Building2, Star, Sparkles, MapPin, Calendar } from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, BarChart, Bar, CartesianGrid, Cell, Legend } from 'recharts';
import { loadInstitutionDetail } from '../lib/data';
import type { InstitutionDetail } from '../types';
import Loading from '../components/Loading';
import RiskChip from '../components/RiskChip';
import Panel from '../components/Panel';
import * as watchlist from '../lib/watchlist';
import { fmtInt, tierColor, fmtDate } from '../lib/format';
import clsx from 'clsx';

export default function InstitutionDetailPage() {
  const { certId = '' } = useParams();
  const [d, setD] = useState<InstitutionDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isWatched, setIsWatched] = useState(watchlist.has(certId));

  useEffect(() => {
    setD(null);
    loadInstitutionDetail(certId).then(setD).catch((e) => setErr(String(e)));
    const unsub = watchlist.subscribe(() => setIsWatched(watchlist.has(certId)));
    return unsub;
  }, [certId]);

  if (err) return <div className="text-rose-300 text-sm">Failed to load: {err}</div>;
  if (!d) return <Loading />;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/institutions" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-[#FFCB05]">
          <ArrowLeft className="h-4 w-4" /> All institutions
        </Link>
      </div>

      <div className="panel p-6 lg:p-7 relative overflow-hidden">
        <div className="absolute -top-32 -right-20 h-72 w-72 rounded-full blur-3xl opacity-20" style={{ background: tierColor(d.risk_tier) }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-[#002a5c] border border-[#163d6d] flex items-center justify-center text-[#FFCB05]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="eyebrow">FDIC Cert · {d.cert_id}</div>
              <h1 className="font-display text-3xl lg:text-4xl font-bold mt-1 text-slate-100">{d.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{d.city}, {d.state}</span>
                <span className="inline-flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />Est. {d.established_year}</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#001f44] border border-[#163d6d]">{d.charter_class}</span>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[#001f44] border border-[#163d6d]">{d.asset_class}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RiskChip tier={d.risk_tier} />
            <button
              onClick={() => watchlist.toggle(d.cert_id)}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors',
                isWatched
                  ? 'bg-amber-400/10 text-amber-200 border-amber-400/40 hover:bg-amber-400/20'
                  : 'border-[#163d6d] text-slate-300 hover:bg-[#002a5c]'
              )}
            >
              <Star className="h-4 w-4" fill={isWatched ? 'currentColor' : 'none'} />
              {isWatched ? 'Watching' : 'Watch'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Tile label="Deposits" value={`$${d.deposits_b.toFixed(2)}B`} accent="cyan" />
        <Tile label="Capital ratio" value={`${d.capital_ratio_pct.toFixed(2)}%`} accent={d.capital_ratio_pct >= 10 ? 'emerald' : d.capital_ratio_pct >= 8 ? 'amber' : 'rose'} />
        <Tile label="Net charge-off" value={`${d.net_charge_off_ratio_pct.toFixed(2)}%`} accent={d.net_charge_off_ratio_pct < 0.5 ? 'emerald' : d.net_charge_off_ratio_pct < 1.5 ? 'amber' : 'rose'} />
        <Tile label="Return on assets" value={`${d.return_on_assets_pct.toFixed(2)}%`} accent={d.return_on_assets_pct >= 1 ? 'emerald' : d.return_on_assets_pct >= 0 ? 'amber' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel eyebrow="Quarterly trend" title="Deposits · NPL · Capital — last 8Q" className="lg:col-span-2" bodyClassName="p-0">
          <div className="h-[280px] w-full px-3 pt-3 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={d.quarterly} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
                <CartesianGrid stroke="#163d6d" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="q" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                <YAxis yAxisId="right" orientation="right" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: '#001f44', border: '1px solid #163d6d', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Line yAxisId="left" type="monotone" dataKey="deposits_b" name="Deposits $B" stroke="#FFDA47" strokeWidth={2} dot={{ r: 3, fill: '#FFDA47' }} />
                <Line yAxisId="right" type="monotone" dataKey="npl_ratio" name="NPL %" stroke="#fb7185" strokeWidth={2} dot={{ r: 3, fill: '#fb7185' }} />
                <Line yAxisId="right" type="monotone" dataKey="capital_ratio" name="Capital %" stroke="#FFCB05" strokeWidth={2} dot={{ r: 3, fill: '#FFCB05' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <div className="panel p-5 relative overflow-hidden glow-ring">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-[#2F65A7]" />
            <div className="eyebrow">AI Summary</div>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{d.ai_summary}</p>
          <div className="mt-4 text-[11px] text-slate-500 font-mono">
            Generated by gold.mart_institution_risk_score · Cortex Complete
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel eyebrow="Branch geography" title="Branches by state" bodyClassName="p-0">
          <div className="h-[280px] w-full px-3 pt-3 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.branches_by_state} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
                <CartesianGrid stroke="#163d6d" strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="state" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36} />
                <Tooltip
                  contentStyle={{ background: '#001f44', border: '1px solid #163d6d', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any, name: any) => name === 'count' ? [fmtInt(v as number), 'Branches'] : [`$${(v as number).toFixed(2)}B`, 'Deposits']}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {d.branches_by_state.map((b, i) => (
                    <Cell key={i} fill={i === 0 ? '#FFDA47' : '#475569'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel eyebrow="Peer context" title={`Failures in ${d.state} since 2008`}>
          {d.peer_failures.length === 0 ? (
            <div className="text-sm text-slate-400">No failed institutions in {d.state} on record.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.16em] text-slate-500 font-mono">
                  <th className="pb-2 font-semibold">Institution</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {d.peer_failures.map((p, i) => (
                  <tr key={i} className="table-row">
                    <td className="py-2.5 text-slate-200">{p.name}<span className="ml-2 text-[10px] font-mono text-slate-500">{p.charter_class}</span></td>
                    <td className="py-2.5 font-mono text-slate-400 text-xs">{fmtDate(p.close_date)}</td>
                    <td className="py-2.5 text-slate-400 text-xs">{p.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent: 'emerald' | 'amber' | 'rose' | 'cyan' }) {
  const grad = {
    emerald: 'from-[#FFCB05]/25',
    amber: 'from-amber-400/25',
    rose: 'from-rose-400/25',
    cyan: 'from-[#FFCB05]/25',
  }[accent];
  const text = {
    emerald: 'text-[#FFCB05]',
    amber: 'text-amber-300',
    rose: 'text-rose-300',
    cyan: 'text-[#FFCB05]',
  }[accent];
  return (
    <div className="relative panel p-5 overflow-hidden">
      <div className={`absolute -top-16 -right-16 h-32 w-32 rounded-full bg-gradient-to-br ${grad} to-transparent blur-2xl pointer-events-none`} />
      <div className="eyebrow">{label}</div>
      <div className={`kpi-num mt-2 ${text}`}>{value}</div>
    </div>
  );
}
