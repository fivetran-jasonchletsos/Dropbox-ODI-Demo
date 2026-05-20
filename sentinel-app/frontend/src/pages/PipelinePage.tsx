import { useEffect, useState } from 'react';
import { loadPipeline } from '../lib/data';
import type { Pipeline, EventLevel } from '../types';
import Loading from '../components/Loading';
import Panel from '../components/Panel';
import { fmtInt, fmtDateTime } from '../lib/format';
import { Database, Boxes, Layers, BadgeCheck, AlertTriangle, X, RefreshCw, Folder } from 'lucide-react';
import clsx from 'clsx';

export default function PipelinePage() {
  const [p, setP] = useState<Pipeline | null>(null);
  const [failing, setFailing] = useState(false);

  useEffect(() => { loadPipeline().then(setP); }, []);
  if (!p) return <Loading />;

  const status = failing ? 'error' : 'ok';

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="eyebrow">ODI</div>
          <h1 className="font-display text-4xl font-bold mt-1">Pipeline</h1>
          <p className="text-slate-400 text-sm mt-1">Fivetran → Snowflake bronze → <span className="text-[#FFCB05] font-semibold">dbt labs</span> → silver → <span className="text-[#FFCB05] font-semibold">dbt labs</span> → gold.</p>
        </div>
        <button
          onClick={() => setFailing((f) => !f)}
          className={clsx(
            'inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors',
            failing
              ? 'bg-rose-500/20 text-rose-200 border-rose-400/40 hover:bg-rose-500/30'
              : 'border-[#163d6d] text-slate-300 hover:bg-[#002a5c]'
          )}
        >
          {failing ? <X className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {failing ? 'Recover pipeline' : 'Simulate failure'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <Stage
          icon={<Folder className="h-5 w-5" />}
          title="Source"
          subtitle={p.source.connector === 'dropbox' ? 'Dropbox' : 'FDIC API'}
          status="ok"
          rows={p.source.file_count}
          metric="files"
          updated={p.source.last_run}
          tables={[
            { name: p.source.folder, rows: p.source.file_count, updated_at: p.source.last_run },
          ]}
          showLabel={false}
        />
        <Stage
          icon={<Database className="h-5 w-5" />}
          title="Bronze"
          subtitle="Raw landing · Iceberg"
          status={status}
          rows={p.layers.bronze.tables.reduce((a, b) => a + b.rows, 0)}
          metric="rows"
          tables={p.layers.bronze.tables}
          edgeLabel="dbt labs"
        />
        <Stage
          icon={<Boxes className="h-5 w-5" />}
          title="Silver"
          subtitle="Conformed · Iceberg"
          status={status}
          rows={p.layers.silver.tables.reduce((a, b) => a + b.rows, 0)}
          metric="rows"
          tables={p.layers.silver.tables}
          edgeLabel="dbt labs"
        />
        <Stage
          icon={<Layers className="h-5 w-5" />}
          title="Gold"
          subtitle="Analytics-ready · marts"
          status={status}
          rows={p.layers.gold.tables.reduce((a, b) => a + b.rows, 0)}
          metric="rows"
          tables={p.layers.gold.tables}
          last
        />
      </div>

      <Panel
        eyebrow="Recent events"
        title="Pipeline activity log"
        right={
          <span className="inline-flex items-center gap-2 text-[11px] font-mono">
            <span className={clsx('h-1.5 w-1.5 rounded-full pulse-dot', failing ? 'bg-rose-400' : 'bg-emerald-400')} />
            {failing ? 'DEGRADED' : 'HEALTHY'}
          </span>
        }
        bodyClassName="p-0"
      >
        <ul className="divide-y divide-[#163d6d]">
          {p.recent_events.map((e, i) => (
            <li key={i} className="px-5 py-3 flex items-start gap-3 hover:bg-[#001a37]">
              <LevelDot level={e.level} />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-slate-200">{e.msg}</div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{fmtDateTime(e.ts)}</div>
              </div>
              <LevelBadge level={e.level} />
            </li>
          ))}
          {failing && (
            <li className="px-5 py-3 flex items-start gap-3 bg-rose-500/10 border-l-2 border-rose-400">
              <LevelDot level="error" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-rose-200">SIMULATED FAILURE · gold.mart_institution_risk_score model_failed_run</div>
                <div className="text-[11px] text-rose-300/70 font-mono mt-0.5">just now · use the toggle above to recover</div>
              </div>
              <LevelBadge level="error" />
            </li>
          )}
        </ul>
      </Panel>
    </div>
  );
}

interface StageProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: 'ok' | 'warn' | 'error';
  rows: number;
  metric: string;
  updated?: string;
  tables: { name: string; rows: number; updated_at: string; depends_on?: string[] }[];
  edgeLabel?: string;
  showLabel?: boolean;
  last?: boolean;
}

function Stage({ icon, title, subtitle, status, rows, metric, tables, edgeLabel, last }: StageProps) {
  const titleColor = title === 'Bronze' ? 'text-amber-300' : title === 'Silver' ? 'text-slate-200' : title === 'Gold' ? 'text-yellow-200' : 'text-[#FFCB05]';
  return (
    <div className="relative">
      <div className="panel p-4 h-full flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={clsx('h-8 w-8 rounded-lg bg-[#002a5c] border border-[#163d6d] flex items-center justify-center', titleColor)}>
              {icon}
            </div>
            <div>
              <div className={clsx('text-[13px] font-bold uppercase tracking-[0.16em] font-mono', titleColor)}>{title}</div>
              <div className="text-[11px] text-slate-500">{subtitle}</div>
            </div>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">{metric}</div>
          <div className="font-display text-2xl font-semibold tabular text-slate-100 mt-0.5">{fmtInt(rows)}</div>
          <div className="text-[11px] text-slate-500 mt-1">{tables.length} {tables.length === 1 ? 'object' : 'tables'}</div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#163d6d] flex-1 overflow-hidden">
          <div className="space-y-1 max-h-[180px] overflow-y-auto scroll-thin pr-1">
            {tables.slice(0, 10).map((t) => (
              <div key={t.name} className="flex items-center justify-between text-[11.5px] font-mono">
                <span className="text-slate-300 truncate">{t.name}</span>
                <span className="text-slate-500 tabular shrink-0 ml-2">{fmtInt(t.rows)}</span>
              </div>
            ))}
            {tables.length > 10 && <div className="text-[11px] text-slate-500">+{tables.length - 10} more…</div>}
          </div>
        </div>
      </div>

      {!last && edgeLabel && (
        <div className="hidden lg:flex absolute top-1/2 -right-3 z-10 -translate-y-1/2 items-center pointer-events-none">
          <FlowArrow label={edgeLabel} />
        </div>
      )}
    </div>
  );
}

function FlowArrow({ label }: { label: string }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.18em] font-mono text-[#FFCB05] bg-[#00152e] px-2 py-0.5 border border-[#FFCB05]/30 rounded">
        {label}
      </div>
      <svg width="32" height="20" viewBox="0 0 32 20" className="overflow-visible">
        <defs>
          <linearGradient id="flow-arrow" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FFDA47" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FFDA47" stopOpacity="1" />
          </linearGradient>
        </defs>
        <line x1="0" y1="10" x2="24" y2="10" stroke="url(#flow-arrow)" strokeWidth="2" className="arrow-flow" />
        <polygon points="24,4 32,10 24,16" fill="#FFDA47" />
      </svg>
    </div>
  );
}

function StatusPill({ status }: { status: 'ok' | 'warn' | 'error' }) {
  const cfg = {
    ok:    { c: 'text-[#FFCB05] bg-emerald-400/10 border-emerald-400/30', label: 'OK', Icon: BadgeCheck },
    warn:  { c: 'text-amber-300 bg-amber-400/10 border-amber-400/30', label: 'WARN', Icon: AlertTriangle },
    error: { c: 'text-rose-300 bg-rose-400/10 border-rose-400/30', label: 'ERROR', Icon: AlertTriangle },
  }[status];
  return (
    <span className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-[0.12em] font-mono', cfg.c)}>
      <cfg.Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function LevelDot({ level }: { level: EventLevel }) {
  const c = level === 'error' ? 'bg-rose-400' : level === 'warn' ? 'bg-amber-400' : 'bg-[#FFCB05]';
  return <span className={clsx('h-2 w-2 rounded-full mt-1.5 shrink-0', c)} />;
}

function LevelBadge({ level }: { level: EventLevel }) {
  const cfg = {
    info:  { c: 'text-[#FFCB05] bg-[#FFCB05]/10 border-[#FFCB05]/30',  label: 'INFO' },
    warn:  { c: 'text-amber-300 bg-amber-400/10 border-amber-400/30', label: 'WARN' },
    error: { c: 'text-rose-300 bg-rose-400/10 border-rose-400/30', label: 'ERROR' },
  }[level];
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-[0.12em] font-mono', cfg.c)}>
      {cfg.label}
    </span>
  );
}
