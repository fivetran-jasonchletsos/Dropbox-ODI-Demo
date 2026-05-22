import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Building2, DollarSign, AlertTriangle, BadgeCheck, Layers, Cpu, FolderTree, Sparkles, Database, ArrowRight } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { loadSummary, loadFailures } from '../lib/data';
import type { Summary, FailureRow } from '../types';
import CountUp from '../components/CountUp';
import Panel from '../components/Panel';
import Loading from '../components/Loading';
import { fmtB, fmtInt } from '../lib/format';

const DOMAIN_COLORS: Record<string, string> = {
  FinServ: '#FFDA47',
  Healthcare: '#FFCB05',
  Retail: '#fbbf24',
  HigherEd: '#00274C',
  Manufacturing: '#fb923c',
  Macro: '#60a5fa',
  Other: '#94a3b8',
};

export default function HomePage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failures, setFailures] = useState<FailureRow[] | null>(null);

  useEffect(() => {
    loadSummary().then(setSummary).catch(() => {});
    loadFailures().then(setFailures).catch(() => {});
  }, []);

  if (!summary) return <Loading label="Loading sentinel telemetry" />;

  const failuresLast5y = (failures ?? []).filter((f) => f.close_date >= '2021-01-01').length;

  const totalDomain = summary.file_inventory.by_domain.reduce((a, b) => a + b.count, 0);

  return (
    <div className="space-y-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-2xl border border-[#253047] p-8 lg:p-12">
        <div className="absolute -top-32 -right-24 h-[420px] w-[420px] rounded-full blur-3xl opacity-20" style={{ background: 'radial-gradient(circle, #0061FF 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -left-20 h-[320px] w-[320px] rounded-full blur-3xl opacity-15" style={{ background: 'radial-gradient(circle, #00c9b1 0%, transparent 70%)' }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 font-mono mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 pulse-dot" />
            FDIC public data · synced {new Date(summary.last_synced_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          <h1 className="font-display text-[60px] sm:text-[80px] lg:text-[92px] leading-[0.92] font-semibold tracking-tight" style={{ fontOpticalSizing: 'auto' }}>
            <span className="accent-text">Sentinel</span>
          </h1>
          <div className="mt-4 text-[17px] lg:text-[21px] text-slate-300 max-w-3xl leading-relaxed">
            A CDO inherits 583 files and turns them into a national risk picture, on{' '}
            <span className="text-[#4d8fff] font-semibold">Open Data Infrastructure</span>.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10">
            <Kpi
              icon={<Building2 className="h-5 w-5 text-emerald-400" />}
              label="Institutions tracked"
              value={summary.total_institutions}
              format={(n) => fmtInt(Math.round(n))}
              accent="from-emerald-400/25 to-emerald-400/0"
            />
            <Kpi
              icon={<DollarSign className="h-5 w-5 text-[#4d8fff]" />}
              label="Deposits monitored"
              value={summary.total_deposits_b}
              format={(n) => '$' + fmtB(n, 1)}
              accent="from-[#0061FF]/25 to-[#0061FF]/0"
            />
            <Kpi
              icon={<AlertTriangle className="h-5 w-5 text-rose-400" />}
              label="Failures since 2008"
              value={summary.total_failed_banks_since_2008}
              format={(n) => fmtInt(Math.round(n))}
              accent="from-rose-400/25 to-rose-400/0"
            />
          </div>
        </div>
      </section>

      {/* THREE PILLARS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <PillarCard
          icon={<Database className="h-5 w-5" />}
          eyebrow="Open Storage"
          title="Apache Iceberg"
          body="Open table format on object storage. No proprietary lock-in. Snapshots, schema evolution, time travel by design."
        />
        <PillarCard
          icon={<Cpu className="h-5 w-5" />}
          eyebrow="Multi-Engine"
          title="Pick your compute"
          body="Snowflake, DuckDB, Athena, Trino, Spark — all query the same gold tables. Your data, your engine."
        />
        <PillarCard
          icon={<Sparkles className="h-5 w-5" />}
          eyebrow="AI-Ready"
          title="Cortex and beyond"
          body="Gold layer is wired for AI: vector indexes, dbt semantic models, and clean facts ready for retrieval-augmented agents."
        />
      </section>

      {/* DATA INVENTORY + TREND */}
      <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Panel
          eyebrow="Source data"
          title="Where the 583 files came from"
          right={
            <Link to="/catalog" className="inline-flex items-center gap-1 text-[#FFCB05] hover:text-cyan-200">
              View catalog <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          }
          className="lg:col-span-3"
        >
          <p className="text-sm text-slate-400 mb-5 leading-relaxed">
            A single Dropbox folder. Mixed exports from prior projects across seven business domains.
            Fivetran indexed every file; <span className="text-[#4d8fff] font-semibold">dbt labs</span> conformed them into bronze, silver, gold.
          </p>

          <div className="relative h-9 rounded-md overflow-hidden border border-[#163d6d] flex">
            {summary.file_inventory.by_domain.map((d) => {
              const w = (d.count / totalDomain) * 100;
              return (
                <div
                  key={d.domain}
                  className="h-full relative group transition-opacity"
                  style={{ width: `${w}%`, background: DOMAIN_COLORS[d.domain] ?? '#94a3b8' }}
                  title={`${d.domain} · ${d.count} files`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity bg-white/20" />
                </div>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
            {summary.file_inventory.by_domain.map((d) => (
              <div key={d.domain} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: DOMAIN_COLORS[d.domain] ?? '#94a3b8' }} />
                <span className="text-slate-300">{d.domain}</span>
                <span className="ml-auto text-slate-500 font-mono">{d.count}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-[#163d6d]">
            <Stat label="Total files" value="583" />
            <Stat label="Total size" value="76.5 GB" />
            <Stat label="Extensions" value={String(summary.file_inventory.by_ext.length)} />
          </div>
        </Panel>

        <Panel
          eyebrow="National signal"
          title="Failures per year"
          right={`${failuresLast5y} in last 5y`}
          className="lg:col-span-2"
          bodyClassName="p-0"
        >
          <div className="h-[260px] w-full px-2 pt-3 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={summary.national_failure_trend} margin={{ left: 8, right: 16, top: 16, bottom: 8 }}>
                <defs>
                  <linearGradient id="failTrend" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="year" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#001f44', border: '1px solid #163d6d', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#94a3b8' }}
                  itemStyle={{ color: '#fb7185' }}
                  cursor={{ stroke: '#163d6d' }}
                />
                <Area type="monotone" dataKey="count" stroke="#fb7185" strokeWidth={1.8} fill="url(#failTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="px-5 pb-5 text-[12px] text-slate-400">
            2008–2010 financial crisis spike, then the 2023 regional bank stress (SVB · Signature · First Republic).
          </div>
        </Panel>
      </section>

      {/* QUICK NAV */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <QuickLink to="/institutions" icon={<Building2 className="h-4 w-4" />} title="Browse institutions" body="150 banks · sortable · filterable · watchlist-ready" />
        <QuickLink to="/states" icon={<Layers className="h-4 w-4" />} title="State risk map" body="51-state heatmap with 5-year failure rates" />
        <QuickLink to="/architecture" icon={<Network className="h-4 w-4" />} title="ODI architecture" body="See the bronze→silver→gold lineage in one diagram" />
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, format, accent }: { icon: React.ReactNode; label: string; value: number; format?: (n: number) => string; accent: string }) {
  return (
    <div className={`relative rounded-xl border border-[#253047] bg-[#161d2a] p-5 overflow-hidden`}>
      <div className={`absolute -top-20 -right-20 h-40 w-40 rounded-full bg-gradient-to-br ${accent} opacity-60 blur-2xl pointer-events-none`} />
      <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-[0.18em] font-mono">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-3 kpi-num">
        <CountUp value={value} format={format} />
      </div>
    </div>
  );
}

function PillarCard({ icon, eyebrow, title, body }: { icon: React.ReactNode; eyebrow: string; title: string; body: string }) {
  return (
    <div className="relative panel p-5 overflow-hidden group">
      <div className="absolute -top-16 -right-16 h-32 w-32 rounded-full opacity-10 blur-2xl group-hover:opacity-20 transition-opacity" style={{ background: 'radial-gradient(circle, #0061FF 0%, #00c9b1 100%)' }} />
      <div className="relative">
        <div className="h-9 w-9 rounded-lg bg-[#1e2a3d] border border-[#253047] flex items-center justify-center text-[#4d8fff] mb-4">
          {icon}
        </div>
        <div className="eyebrow">{eyebrow}</div>
        <div className="font-display text-[20px] font-semibold mt-1 text-slate-100">{title}</div>
        <div className="text-[13.5px] text-slate-400 mt-2 leading-relaxed">{body}</div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-slate-500 font-mono">{label}</div>
      <div className="text-xl font-display font-semibold mt-1 tabular text-slate-100">{value}</div>
    </div>
  );
}

function QuickLink({ to, icon, title, body }: { to: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link to={to} className="group panel p-5 flex items-center gap-4 hover:border-[#0061FF]/40 transition-colors">
      <div className="h-10 w-10 rounded-lg bg-[#1e2a3d] border border-[#253047] flex items-center justify-center text-[#4d8fff] shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-100 group-hover:text-white">{title}</div>
        <div className="text-[12.5px] text-slate-400 truncate">{body}</div>
      </div>
      <ArrowRight className="h-4 w-4 text-slate-500 group-hover:text-[#4d8fff] group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

function Network({ className = '' }: { className?: string }) {
  return <FolderTree className={className} />;
}
