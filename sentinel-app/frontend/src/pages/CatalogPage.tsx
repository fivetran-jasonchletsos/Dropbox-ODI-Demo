import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { loadCatalog, loadSummary } from '../lib/data';
import type { CatalogFile, Summary } from '../types';
import Loading from '../components/Loading';
import Panel from '../components/Panel';
import { fmtInt, fmtBytes } from '../lib/format';
import { Search, FileText, Database, CheckCircle2, Circle } from 'lucide-react';
import clsx from 'clsx';

const DOMAIN_COLORS: Record<string, string> = {
  FinServ: '#FFDA47', Healthcare: '#FFCB05', Retail: '#fbbf24',
  HigherEd: '#00274C', Manufacturing: '#fb923c', Macro: '#60a5fa', Other: '#94a3b8',
};

const EXT_ICONS: Record<string, string> = {
  csv: '◧', xlsx: '◨', xls: '◨', pdf: '▤', pptx: '▥', ppt: '▥', docx: '▦', doc: '▦',
  txt: '≣', zip: '◰', '7z': '◰', gz: '◰', tar: '◰', mdf: '◇', ldf: '◇', dmp: '◇',
  sql: 'λ', xml: '⟨⟩', json: '{}', parquet: '▢', md: '#',
};

export default function CatalogPage() {
  const [files, setFiles] = useState<CatalogFile[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [q, setQ] = useState('');
  const [ext, setExt] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [parsedOnly, setParsedOnly] = useState(false);

  useEffect(() => {
    loadCatalog().then(setFiles);
    loadSummary().then(setSummary);
  }, []);

  const filtered = useMemo(() => {
    if (!files) return [];
    const needle = q.trim().toLowerCase();
    return files.filter((f) => {
      if (needle && !f.name.toLowerCase().includes(needle)) return false;
      if (ext && f.ext !== ext) return false;
      if (domain && f.domain !== domain) return false;
      if (parsedOnly && !f.parsed) return false;
      return true;
    });
  }, [files, q, ext, domain, parsedOnly]);

  if (!files || !summary) return <Loading />;

  const extData = summary.file_inventory.by_ext.slice(0, 18);
  const domainData = summary.file_inventory.by_domain;
  const totalBytes = files.reduce((a, b) => a + b.size_kb * 1024, 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="eyebrow">Open Data Infrastructure</div>
        <h1 className="font-display text-4xl font-bold mt-1">File catalog</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
          Every file Fivetran indexed from the Dropbox source folder. {fmtInt(files.length)} files · {fmtBytes(totalBytes)} · {summary.file_inventory.by_ext.length} distinct extensions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Panel className="lg:col-span-2" eyebrow="Distribution" title="By extension" bodyClassName="p-0">
          <div className="h-[260px] px-3 pt-3 pb-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={extData} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
                <XAxis dataKey="ext" stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#475569" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
                <Tooltip contentStyle={{ background: '#001f44', border: '1px solid #163d6d', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {extData.map((_, i) => <Cell key={i} fill={i === 0 ? '#FFDA47' : i < 4 ? '#FFCB05' : i < 8 ? '#00274C' : '#475569'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel eyebrow="Business domain" title="By origin" bodyClassName="p-3">
          <div className="h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={domainData} dataKey="count" nameKey="domain" innerRadius={48} outerRadius={88} paddingAngle={2} stroke="#00152e" strokeWidth={2}>
                  {domainData.map((d) => <Cell key={d.domain} fill={DOMAIN_COLORS[d.domain] ?? '#94a3b8'} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#001f44', border: '1px solid #163d6d', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-y-1 gap-x-3 text-[11px] mt-1">
            {domainData.map((d) => (
              <div key={d.domain} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ background: DOMAIN_COLORS[d.domain] ?? '#94a3b8' }} />
                <span className="text-slate-300">{d.domain}</span>
                <span className="ml-auto text-slate-500 font-mono">{d.count}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="panel p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search filenames…"
              className="w-full rounded-lg bg-[#001f44] border border-[#163d6d] pl-10 pr-3 py-2 text-sm placeholder:text-slate-500 focus:border-[#FFCB05]/60 focus:outline-none"
            />
          </div>
          <select value={ext} onChange={(e) => setExt(e.target.value)} className="rounded-lg bg-[#001f44] border border-[#163d6d] px-3 py-2 text-sm focus:border-[#FFCB05]/60 focus:outline-none">
            <option value="">All extensions</option>
            {summary.file_inventory.by_ext.map((e) => <option key={e.ext} value={e.ext}>{e.ext} ({e.count})</option>)}
          </select>
          <select value={domain} onChange={(e) => setDomain(e.target.value)} className="rounded-lg bg-[#001f44] border border-[#163d6d] px-3 py-2 text-sm focus:border-[#FFCB05]/60 focus:outline-none">
            <option value="">All domains</option>
            {summary.file_inventory.by_domain.map((d) => <option key={d.domain} value={d.domain}>{d.domain} ({d.count})</option>)}
          </select>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#001f44] border border-[#163d6d] text-sm cursor-pointer hover:border-[#FFCB05]/40">
            <input type="checkbox" checked={parsedOnly} onChange={(e) => setParsedOnly(e.target.checked)} className="accent-cyan-400" />
            <span className="text-slate-300">Parsed only</span>
          </label>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          Showing <span className="font-mono tabular text-slate-200">{fmtInt(filtered.length)}</span> of {fmtInt(files.length)} files
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto scroll-thin max-h-[640px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.16em] text-slate-500 font-mono bg-[#001f44] sticky top-0">
                <th className="px-3 py-3 font-semibold border-b border-[#163d6d]">File</th>
                <th className="px-3 py-3 font-semibold border-b border-[#163d6d]">Ext</th>
                <th className="px-3 py-3 font-semibold border-b border-[#163d6d]">Domain</th>
                <th className="px-3 py-3 font-semibold border-b border-[#163d6d] text-right">Size</th>
                <th className="px-3 py-3 font-semibold border-b border-[#163d6d]">Status</th>
                <th className="px-3 py-3 font-semibold border-b border-[#163d6d]">Bronze table</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 200).map((f, i) => (
                <tr key={i} className="table-row">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[#FFCB05] text-[14px] w-5 text-center">{EXT_ICONS[f.ext] ?? '·'}</span>
                      <span className="text-slate-200 font-medium">{f.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-400">.{f.ext}</td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <span className="h-2 w-2 rounded-sm" style={{ background: DOMAIN_COLORS[f.domain] ?? '#94a3b8' }} />
                      <span className="text-slate-300">{f.domain}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono tabular text-slate-400 text-xs">{fmtBytes(f.size_kb * 1024)}</td>
                  <td className="px-3 py-2.5">
                    {f.parsed ? (
                      <span className="inline-flex items-center gap-1.5 text-[#FFCB05] text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Parsed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-slate-500 text-xs">
                        <Circle className="h-3.5 w-3.5" /> Metadata only
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {f.table_name ? (
                      <span className="font-mono text-xs text-[#FFCB05]/90">{f.table_name}</span>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 200 && (
          <div className="px-4 py-3 border-t border-[#163d6d] text-xs text-slate-400 text-center">
            First 200 shown of {fmtInt(filtered.length)} matches — refine filters above.
          </div>
        )}
      </div>
    </div>
  );
}
