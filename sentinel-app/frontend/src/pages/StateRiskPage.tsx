import { useEffect, useMemo, useState } from 'react';
import { loadStateRisk, loadInstitutions, loadFailures } from '../lib/data';
import type { StateRisk, InstitutionRow, FailureRow } from '../types';
import Loading from '../components/Loading';
import Panel from '../components/Panel';
import { fmtInt, riskIndexColor, fmtDate } from '../lib/format';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

const HEX_COORDS: Record<string, [number, number]> = {
  AK:[0,0], ME:[10,0], VT:[9,1], NH:[10,1], WA:[1,1], ID:[2,2], MT:[3,1], ND:[4,1], MN:[5,1],
  WI:[6,1], MI:[8,1], MA:[10,2], NY:[9,2], PA:[8,3], NJ:[9,3], CT:[10,3], RI:[11,2], OR:[1,2],
  NV:[2,3], WY:[3,2], SD:[4,2], IA:[5,2], IL:[6,2], IN:[7,2], OH:[8,2], MD:[9,4], DE:[10,4],
  DC:[9,5], CA:[1,3], UT:[2,4], CO:[3,3], NE:[4,3], MO:[5,3], KY:[7,3], WV:[8,4], VA:[9,5],
  AZ:[2,5], NM:[3,4], KS:[4,4], AR:[5,4], TN:[7,4], NC:[8,5], SC:[9,6], OK:[4,5], LA:[5,5],
  MS:[6,5], AL:[7,5], GA:[8,6], HI:[0,6], TX:[4,6], FL:[8,7], PR:[11,7],
};

export default function StateRiskPage() {
  const [states, setStates] = useState<StateRisk[] | null>(null);
  const [insts, setInsts] = useState<InstitutionRow[] | null>(null);
  const [fails, setFails] = useState<FailureRow[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    loadStateRisk().then((s) => {
      setStates(s);
      const mi = s.find((x) => x.state === 'MI');
      setSel(mi ? 'MI' : s[0]?.state ?? null);
    });
    loadInstitutions().then(setInsts);
    loadFailures().then(setFails);
  }, []);

  const byState = useMemo(() => {
    const m = new Map<string, StateRisk>();
    (states ?? []).forEach((s) => m.set(s.state, s));
    return m;
  }, [states]);

  const selData = sel ? byState.get(sel) ?? null : null;
  const focused = hover ? byState.get(hover) ?? null : selData;

  const selInsts = useMemo(
    () => (insts ?? []).filter((i) => i.state === sel).sort((a, b) => b.deposits_b - a.deposits_b),
    [insts, sel]
  );
  const selFails = useMemo(
    () => (fails ?? []).filter((f) => f.state === sel).slice(0, 8),
    [fails, sel]
  );

  if (!states) return <Loading />;

  const maxCol = Math.max(...Object.values(HEX_COORDS).map(([c]) => c)) + 1;
  const maxRow = Math.max(...Object.values(HEX_COORDS).map(([, r]) => r)) + 1;
  const hexW = 60;
  const hexH = 60;
  const xGap = 6;
  const yGap = -6;
  const width = maxCol * (hexW + xGap) + hexW / 2;
  const height = maxRow * (hexH + yGap) + hexH + 30;

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Pulse</div>
        <h1 className="font-display text-4xl font-bold mt-1">State Risk Map</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
          Risk index by state, computed from average institution risk score and 5-year failure rate. Hover to inspect, click to drill in.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        <Panel className="xl:col-span-3 overflow-hidden" eyebrow="Heatmap" title="51 jurisdictions" bodyClassName="p-4 pb-2">
          <div className="overflow-x-auto scroll-thin">
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block mx-auto">
              {Object.entries(HEX_COORDS).map(([state, [col, row]]) => {
                const x = col * (hexW + xGap) + (row % 2 ? (hexW + xGap) / 2 : 0);
                const y = row * (hexH + yGap);
                const data = byState.get(state);
                const color = data ? riskIndexColor(data.risk_index) : '#253047';
                const isActive = state === sel;
                const isHover = state === hover;
                return (
                  <g key={state}
                     onMouseEnter={() => setHover(state)}
                     onMouseLeave={() => setHover((h) => h === state ? null : h)}
                     onClick={() => setSel(state)}
                     style={{ cursor: 'pointer' }}>
                    <polygon
                      points={hexPoints(x, y, hexW, hexH)}
                      fill={color}
                      fillOpacity={isActive ? 0.95 : isHover ? 0.85 : 0.55}
                      stroke={isActive ? '#fff' : isHover ? '#00c9b1' : 'rgba(15,23,42,0.6)'}
                      strokeWidth={isActive ? 2 : 1}
                    />
                    <text
                      x={x + hexW / 2}
                      y={y + hexH / 2 - 4}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize="11"
                      fontWeight="700"
                      fill={isActive ? '#0d1117' : 'rgba(15,23,42,0.85)'}
                    >
                      {state}
                    </text>
                    {data && (
                      <text
                        x={x + hexW / 2}
                        y={y + hexH / 2 + 9}
                        textAnchor="middle"
                        className="font-mono"
                        fontSize="9"
                        fontWeight="600"
                        fill={isActive ? '#0d1117' : 'rgba(15,23,42,0.7)'}
                      >
                        {data.risk_index}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex items-center gap-4 mt-2 px-2 pb-2 text-[11px] text-slate-400 font-mono">
            <span>Risk index</span>
            <div className="flex items-center gap-1 flex-1 max-w-md">
              <span>0</span>
              <div className="flex-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #4d8fff 0%, #fbbf24 33%, #fb923c 66%, #fb7185 100%)' }} />
              <span>100</span>
            </div>
          </div>
        </Panel>

        <div className="xl:col-span-2 space-y-5">
          {focused && (
            <div className="panel p-5 relative overflow-hidden">
              <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-30" style={{ background: riskIndexColor(focused.risk_index) }} />
              <div className="relative">
                <div className="eyebrow">{hover ? 'Hovered' : 'Selected'}</div>
                <div className="font-display text-2xl font-bold text-slate-100 mt-1">{focused.state_name}</div>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <Mini label="Risk index" value={String(focused.risk_index)} color={riskIndexColor(focused.risk_index)} />
                  <Mini label="Institutions" value={fmtInt(focused.total_institutions)} />
                  <Mini label="Deposits" value={`$${focused.total_deposits_b.toFixed(1)}B`} />
                  <Mini label="Branches" value={fmtInt(focused.total_branches)} />
                  <Mini label="Failures 5y" value={String(focused.failed_count_5y)} />
                  <Mini label="Failure rate 5y" value={`${focused.failure_rate_pct_5y.toFixed(2)}%`} />
                </div>
              </div>
            </div>
          )}

          {selData && (
            <Panel eyebrow="Top by deposits" title={`${selData.state_name} institutions`} bodyClassName="p-0">
              {selInsts.length === 0 ? (
                <div className="p-4 text-sm text-slate-400">No tracked institutions in this state.</div>
              ) : (
                <ul className="divide-y divide-[#253047]">
                  {selInsts.slice(0, 8).map((i) => (
                    <li key={i.cert_id} className="px-4 py-3 hover:bg-[#111827] flex items-center gap-3">
                      <Link to={`/institutions/${i.cert_id}`} className="flex-1 min-w-0">
                        <div className="text-sm text-slate-200 font-medium truncate">{i.name}</div>
                        <div className="text-[11px] text-slate-500">{i.city} · ${i.deposits_b.toFixed(2)}B · {i.branches} branches</div>
                      </Link>
                      <span className={clsx('risk-chip', `risk-${i.risk_tier}`)}>{i.risk_tier}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}

          {selData && selFails.length > 0 && (
            <Panel eyebrow="Failures" title={`${selData.state_name} since 2008`} bodyClassName="p-0">
              <ul className="divide-y divide-[#253047]">
                {selFails.map((f) => (
                  <li key={f.cert_id} className="px-4 py-3 text-sm flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-200 truncate">{f.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{f.city} · acquirer {f.acquirer}</div>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">{fmtDate(f.close_date)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

function hexPoints(x: number, y: number, w: number, h: number): string {
  return [
    [x + w * 0.25, y + h * 0.05],
    [x + w * 0.75, y + h * 0.05],
    [x + w * 1.0,  y + h * 0.5],
    [x + w * 0.75, y + h * 0.95],
    [x + w * 0.25, y + h * 0.95],
    [x + w * 0.0,  y + h * 0.5],
  ].map(([a, b]) => `${a},${b}`).join(' ');
}

function Mini({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-mono">{label}</div>
      <div className="text-xl font-display font-semibold mt-1 tabular" style={{ color: color ?? '#f1f5f9' }}>{value}</div>
    </div>
  );
}
