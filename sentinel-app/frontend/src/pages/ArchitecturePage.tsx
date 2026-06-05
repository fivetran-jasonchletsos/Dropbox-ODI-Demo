import { useEffect, useState } from 'react';
import { loadPipeline } from '../lib/data';
import type { Pipeline } from '../types';
import Loading from '../components/Loading';
import Panel from '../components/Panel';
import { Database, Boxes, Layers, Folder, Zap, Check, X, Cpu } from 'lucide-react';
import clsx from 'clsx';
import { fmtInt } from '../lib/format';

const ENGINES: { key: string; name: string; tagline: string; color: string; sql: string }[] = [
  {
    key: 'snowflake',
    name: 'Snowflake',
    tagline: 'External Iceberg table',
    color: '#29b5e8',
    sql: `-- Snowflake reads gold.mart_institution_risk_score
-- via an Iceberg external table; zero copy, native SQL.
SELECT
    state,
    risk_tier,
    COUNT(*)               AS institutions,
    SUM(deposits_b)        AS total_deposits_b,
    AVG(risk_score)::DECIMAL(5,2) AS avg_risk
FROM gold.mart_institution_risk_score
WHERE asset_class >= '1B-10B'
GROUP BY 1, 2
ORDER BY total_deposits_b DESC;`,
  },
  {
    key: 'duckdb',
    name: 'DuckDB',
    tagline: 'Local query, same Iceberg files',
    color: '#fff100',
    sql: `-- DuckDB attaches the Iceberg catalog directly.
INSTALL iceberg;
LOAD iceberg;

SELECT state, risk_tier,
       COUNT(*) AS institutions,
       SUM(deposits_b) AS total_deposits_b,
       AVG(risk_score) AS avg_risk
FROM iceberg_scan('s3://sentinel-warehouse/gold/mart_institution_risk_score')
WHERE asset_class >= '1B-10B'
GROUP BY 1, 2
ORDER BY total_deposits_b DESC;`,
  },
  {
    key: 'athena',
    name: 'AWS Athena',
    tagline: 'Glue Data Catalog, serverless',
    color: '#ff9900',
    sql: `-- Athena reads the same Iceberg table from the Glue catalog.
SELECT
    state,
    risk_tier,
    COUNT(*)                AS institutions,
    SUM(deposits_b)         AS total_deposits_b,
    ROUND(AVG(risk_score),2) AS avg_risk
FROM "sentinel_gold"."mart_institution_risk_score"
WHERE asset_class >= '1B-10B'
GROUP BY state, risk_tier
ORDER BY total_deposits_b DESC;`,
  },
  {
    key: 'trino',
    name: 'Trino',
    tagline: 'Federated MPP query',
    color: '#dd00a1',
    sql: `-- Trino reads through the Iceberg connector.
SELECT
    state,
    risk_tier,
    count(*)               AS institutions,
    sum(deposits_b)        AS total_deposits_b,
    round(avg(risk_score), 2) AS avg_risk
FROM iceberg.gold.mart_institution_risk_score
WHERE asset_class >= '1B-10B'
GROUP BY state, risk_tier
ORDER BY total_deposits_b DESC;`,
  },
  {
    key: 'spark',
    name: 'Apache Spark',
    tagline: 'Notebook / pipeline workload',
    color: '#e25a1c',
    sql: `# Spark with iceberg-spark-runtime
spark.read.format("iceberg") \\
    .load("warehouse.gold.mart_institution_risk_score") \\
    .filter("asset_class >= '1B-10B'") \\
    .groupBy("state", "risk_tier") \\
    .agg(
        count("*").alias("institutions"),
        sum("deposits_b").alias("total_deposits_b"),
        round(avg("risk_score"), 2).alias("avg_risk"),
    ) \\
    .orderBy(col("total_deposits_b").desc()) \\
    .show()`,
  },
];

const STACK_COMPARE = [
  { label: 'Storage', mds: 'Vendor warehouse', odi: 'Apache Iceberg · open table format' },
  { label: 'Catalog', mds: 'Locked to vendor', odi: 'AWS Glue · Polaris · REST catalogs' },
  { label: 'Compute', mds: 'One engine', odi: 'Any engine — Snowflake, DuckDB, Athena, Trino, Spark' },
  { label: 'Transform', mds: 'Vendor SQL only', odi: 'dbt labs — bronze · silver · gold' },
  { label: 'Egress cost', mds: 'High · vendor-priced', odi: 'Cloud storage rates' },
  { label: 'AI workloads', mds: 'Bolt-on', odi: 'Native · same gold tables feed run-time agents, vector DBs, retrieval' },
  { label: 'Lock-in', mds: 'Multi-year contract', odi: 'Move data by changing the catalog pointer' },
];

export default function ArchitecturePage() {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [engineKey, setEngineKey] = useState<string>('snowflake');
  const [openLayer, setOpenLayer] = useState<'bronze' | 'silver' | 'gold'>('gold');

  useEffect(() => { loadPipeline().then(setPipeline); }, []);

  if (!pipeline) return <Loading />;
  const engine = ENGINES.find((e) => e.key === engineKey)!;
  const layerTables = pipeline.layers[openLayer].tables;

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow">ODI</div>
        <h1 className="font-display text-4xl lg:text-5xl font-bold mt-1">Architecture</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-3xl">
          One source of truth — open table format on object storage. Every layer of the stack is replaceable, every engine speaks the same SQL, and{' '}
          <span className="text-[#FFCB05] font-semibold">dbt labs</span> conforms the data on the way through.
        </p>
      </div>

      {/* LINEAGE DIAGRAM */}
      <Panel eyebrow="Lineage" title="End-to-end data flow" bodyClassName="p-6 lg:p-8">
        <LineageDiagram />
      </Panel>

      {/* MULTI ENGINE */}
      <Panel
        eyebrow="Multi-engine"
        title="Same gold table · five engines"
        right="One Iceberg query target"
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {ENGINES.map((e) => (
            <button
              key={e.key}
              onClick={() => setEngineKey(e.key)}
              className={clsx(
                'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors',
                engineKey === e.key
                  ? 'bg-[#1e2a3d] border-[#0061FF]/50 text-[#4d8fff]'
                  : 'border-[#253047] text-slate-300 hover:bg-[#161d2a]'
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ background: e.color }} />
              {e.name}
            </button>
          ))}
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-mono">{engine.tagline}</div>
          <div className="text-[11px] text-slate-500 font-mono">gold.mart_institution_risk_score</div>
        </div>
        <pre className="rounded-lg bg-[#0a0e16] border border-[#253047] p-5 overflow-x-auto scroll-thin text-[13px] font-mono leading-relaxed text-slate-200">
          <code dangerouslySetInnerHTML={{ __html: highlightSql(engine.sql) }} />
        </pre>
      </Panel>

      {/* COMPARISON */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel eyebrow="Side by side" title="Modern Data Stack vs ODI" bodyClassName="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-[0.16em] text-slate-500 font-mono">
                <th className="text-left px-5 py-3 border-b border-[#163d6d]">Dimension</th>
                <th className="text-left px-5 py-3 border-b border-[#163d6d]">
                  <div className="flex items-center gap-1.5"><X className="h-3 w-3 text-slate-500" /> MDS</div>
                </th>
                <th className="text-left px-5 py-3 border-b border-[#163d6d]">
                  <div className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> ODI</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {STACK_COMPARE.map((row) => (
                <tr key={row.label} className="table-row">
                  <td className="px-5 py-2.5 text-slate-300 font-medium">{row.label}</td>
                  <td className="px-5 py-2.5 text-slate-500 text-[13px]">{row.mds}</td>
                  <td className="px-5 py-2.5 text-emerald-200 text-[13px]">{row.odi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel eyebrow="Catalog explorer" title="Browse the warehouse">
          <div className="flex gap-1 p-1 bg-[#001f44] rounded-lg border border-[#163d6d] w-fit mb-4">
            {(['bronze','silver','gold'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setOpenLayer(l)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-mono uppercase tracking-[0.16em] rounded-md transition-colors',
                  openLayer === l
                    ? l === 'bronze' ? 'bg-amber-500/20 text-amber-200' : l === 'silver' ? 'bg-slate-500/20 text-slate-200' : 'bg-[#0061FF]/15 text-[#4d8fff]'
                    : 'text-slate-400 hover:text-slate-200'
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <div className="space-y-1 max-h-[320px] overflow-y-auto scroll-thin pr-2">
            {layerTables.map((t) => (
              <div key={t.name} className="flex items-center justify-between text-[13px] px-3 py-2 rounded hover:bg-[#002a5c] group cursor-pointer">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={clsx('h-1.5 w-1.5 rounded-full shrink-0', openLayer === 'bronze' ? 'bg-amber-400' : openLayer === 'silver' ? 'bg-slate-400' : 'bg-yellow-400')} />
                  <span className="font-mono text-slate-200 truncate">{t.name}</span>
                  {t.depends_on && t.depends_on.length > 0 && (
                    <span className="text-[10px] font-mono text-slate-500 hidden md:inline">← {t.depends_on.slice(0,2).join(', ')}{t.depends_on.length>2?', …':''}</span>
                  )}
                </div>
                <span className="font-mono tabular text-xs text-slate-500 shrink-0">{fmtInt(t.rows)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function LineageDiagram() {
  // Nodes layout
  const nodes = [
    { key: 'dropbox',  x: 60,   y: 110, label: 'Dropbox',   sub: '583 files',    icon: <Folder className="h-4 w-4" />, color: '#0061ff' },
    { key: 'fivetran', x: 230,  y: 110, label: 'Fivetran',  sub: 'Connector',    icon: <Zap className="h-4 w-4" />,    color: '#0070f3' },
    { key: 'bronze',   x: 410,  y: 110, label: 'Bronze',    sub: 'Iceberg · raw',icon: <Database className="h-4 w-4" />,color: '#fb923c' },
    { key: 'silver',   x: 605,  y: 110, label: 'Silver',    sub: 'Conformed',    icon: <Boxes className="h-4 w-4" />,  color: '#94a3b8' },
    { key: 'gold',     x: 800,  y: 110, label: 'Gold',      sub: 'Marts',        icon: <Layers className="h-4 w-4" />, color: '#fcd34d' },
    { key: 'sentinel', x: 1000, y: 110, label: 'Sentinel',  sub: 'This app',     icon: <Cpu className="h-4 w-4" />,    color: '#FFCB05' },
  ];
  const edges: { from: string; to: string; label?: string }[] = [
    { from: 'dropbox',  to: 'fivetran' },
    { from: 'fivetran', to: 'bronze' },
    { from: 'bronze',   to: 'silver', label: 'dbt labs' },
    { from: 'silver',   to: 'gold',   label: 'dbt labs' },
    { from: 'gold',     to: 'sentinel' },
  ];
  const byKey = Object.fromEntries(nodes.map((n) => [n.key, n]));

  return (
    <div className="overflow-x-auto scroll-thin">
      <svg viewBox="0 0 1080 220" className="w-full min-w-[940px] block">
        <defs>
          <linearGradient id="edgeGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#4d8fff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4d8fff" stopOpacity="0.9" />
          </linearGradient>
          <marker id="arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#4d8fff" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = byKey[e.from];
          const b = byKey[e.to];
          const x1 = a.x + 80;
          const x2 = b.x;
          const y = 110 + 30;
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={x2 - 8} y2={y} stroke="url(#edgeGrad)" strokeWidth="2.5" className="arrow-flow" markerEnd="url(#arrowhead)" />
              {e.label && (
                <g>
                  <rect x={(x1 + x2) / 2 - 38} y={y - 32} width="76" height="20" rx="4" fill="#0d1117" stroke="#4d8fff" strokeOpacity="0.5" />
                  <text x={(x1 + x2) / 2} y={y - 18} textAnchor="middle" fontSize="11" fontWeight="700" fill="#4d8fff" className="font-mono" style={{ letterSpacing: '0.1em' }}>
                    {e.label.toUpperCase()}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {nodes.map((n) => (
          <g key={n.key} transform={`translate(${n.x}, ${n.y})`}>
            <rect width="80" height="80" rx="14" fill="#161d2a" stroke={n.color} strokeOpacity="0.6" strokeWidth="1.5" />
            <rect width="80" height="80" rx="14" fill={n.color} fillOpacity="0.07" />
            <foreignObject x="0" y="0" width="80" height="80">
              <div style={{ width: 80, height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: n.color }}>
                {n.icon}
                <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>{n.label}</div>
                <div style={{ fontSize: 9, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>{n.sub}</div>
              </div>
            </foreignObject>
          </g>
        ))}
      </svg>
    </div>
  );
}

function highlightSql(src: string): string {
  const escaped = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return escaped
    .replace(/(--[^\n]*)/g, '<span style="color:#475569">$1</span>')
    .replace(/('[^']*')/g, '<span style="color:#00c9b1">$1</span>')
    .replace(/\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|JOIN|ON|AS|AND|OR|COUNT|SUM|AVG|ROUND|MIN|MAX|WITH|CASE|WHEN|THEN|ELSE|END|DESC|ASC|LIMIT|HAVING|INSTALL|LOAD|spark\.read|format|load|filter|groupBy|agg|orderBy|count|sum|avg|round|alias|col|show|read|iceberg_scan)\b/gi,
      '<span style="color:#4d8fff;font-weight:600">$1</span>')
    .replace(/\b(DECIMAL|VARCHAR|TIMESTAMP|INT|DATE|BOOLEAN)\b/gi, '<span style="color:#0061FF">$1</span>');
}
