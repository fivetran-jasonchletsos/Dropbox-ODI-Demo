import Panel from '../components/Panel';
import { ExternalLink, Github, Layers, Sparkles, Zap } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <section className="rounded-lg border border-[#163d6d] bg-[#002a5c]/60 p-6">
        <div className="eyebrow text-[#FFCB05]">The ODI Story</div>
        <h2 className="font-display text-3xl font-bold mt-1 text-slate-50">
          Data infrastructure for agents you trust.
        </h2>
        <p className="mt-3 text-slate-300 text-sm leading-relaxed">
          <em>"MDS was optimized for humans. ODI is designed for a future with humans and
          production agents at scale."</em> This demo is one instance of that architecture:
          Fivetran's 750+ connectors and Managed Data Lake Service (MDLS) land data into open
          table formats; <span className="text-[#FFCB05] font-semibold">dbt</span> transformations
          build the governed semantic layer; multiple compute engines and AI agents read the same
          gold tables.
        </p>
        <a
          href="https://fivetran-jasonchletsos.github.io/Fivetran-Demo-Repository/story/"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#FFCB05] hover:text-cyan-200"
        >
          Read the full ODI Story →
        </a>
      </section>

      <div>
        <div className="eyebrow">Meta</div>
        <h1 className="font-display text-4xl font-bold mt-1">About Sentinel</h1>
        <p className="text-slate-400 text-sm mt-1 max-w-2xl">
          Sentinel is the customer-facing surface of the Dropbox ODI demo. A CDO inherits a shared drive with 583 files. Fivetran picks them up,
          <span className="text-[#FFCB05] font-semibold"> dbt labs</span> conforms them on bronze → silver and silver → gold, and Sentinel is the gold-layer dashboard.
        </p>
      </div>

      <Panel eyebrow="Tech stack" title="Frontend">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Row label="Build" value="Vite + React 18 + TypeScript" />
          <Row label="Styling" value="Tailwind CSS v4 (@import)" />
          <Row label="Routing" value="React Router v6" />
          <Row label="Charts" value="Recharts" />
          <Row label="Icons" value="lucide-react" />
          <Row label="Data" value="Static JSON, generated at build time" />
        </div>
      </Panel>

      <Panel eyebrow="Data lineage" title="What feeds this app">
        <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-[#002a5c] border border-[#163d6d] flex items-center justify-center text-[#FFCB05] shrink-0"><Zap className="h-3.5 w-3.5" /></div>
            <div><strong className="text-slate-100">Fivetran</strong> · Dropbox connector continuously syncs the source folder. Schema drift handled automatically.</div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-[#002a5c] border border-[#163d6d] flex items-center justify-center text-amber-300 shrink-0"><Layers className="h-3.5 w-3.5" /></div>
            <div><strong className="text-slate-100">Bronze · Iceberg</strong> · Raw landing tables, one per source file shape. Schema-on-read, time travel, snapshots.</div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-[#002a5c] border border-[#163d6d] flex items-center justify-center text-[#FFCB05] shrink-0 font-mono text-[10px] font-bold">dbt</div>
            <div><strong className="text-slate-100">dbt labs</strong> · Tests, lineage, and semantic models for every transformation between bronze, silver, and gold.</div>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-7 w-7 rounded-lg bg-[#002a5c] border border-[#163d6d] flex items-center justify-center text-yellow-300 shrink-0"><Sparkles className="h-3.5 w-3.5" /></div>
            <div><strong className="text-slate-100">Gold · marts</strong> · The tables Sentinel reads: <span className="font-mono text-xs text-[#FFCB05]/90">mart_institution_risk_score</span>, <span className="font-mono text-xs text-[#FFCB05]/90">agg_state_risk</span>, <span className="font-mono text-xs text-[#FFCB05]/90">fact_failed_banks</span>.</div>
          </div>
        </div>
      </Panel>

      <Panel eyebrow="Data sources" title="Public FDIC datasets">
        <ul className="space-y-2 text-sm text-slate-300">
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFCB05]" />
            <span>FDIC Failed Bank List · <a className="text-[#FFCB05] hover:text-cyan-200 inline-flex items-center gap-1" href="https://www.fdic.gov/resources/resolutions/bank-failures/failed-bank-list/" target="_blank" rel="noreferrer">fdic.gov <ExternalLink className="h-3 w-3" /></a></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFCB05]" />
            <span>FDIC Summary of Deposits · <a className="text-[#FFCB05] hover:text-cyan-200 inline-flex items-center gap-1" href="https://www7.fdic.gov/sod/" target="_blank" rel="noreferrer">fdic.gov/sod <ExternalLink className="h-3 w-3" /></a></span>
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FFCB05]" />
            <span>FDIC BankFind Suite (Institutions) · <a className="text-[#FFCB05] hover:text-cyan-200 inline-flex items-center gap-1" href="https://banks.data.fdic.gov/" target="_blank" rel="noreferrer">banks.data.fdic.gov <ExternalLink className="h-3 w-3" /></a></span>
          </li>
        </ul>
        <p className="text-[12.5px] text-slate-500 mt-4 leading-relaxed">
          Risk scores, AI summaries, and quarterly trends shown in this app are synthetic — generated from a deterministic PRNG to keep the demo reproducible.
          All institution names, except for the famous failures (WaMu, IndyMac, SVB, Signature, First Republic, Silvergate, Republic First, Heartland Tri-State), are fictional.
        </p>
      </Panel>

      <Panel eyebrow="Credits" title="Built by Jason Chletsos">
        <p className="text-sm text-slate-300 leading-relaxed">
          Part of the Fivetran <span className="text-[#FFCB05]">Open Data Infrastructure</span> demo series. Sister demos: Meridian Capital (FinServ),
          Epic Clarity (Healthcare), Atlas Risk (Insurance), Lighthouse Media, Storefront Analytics (Retail), and more.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 font-mono">
          <Github className="h-3.5 w-3.5" />
          fivetran-jasonchletsos / Dropbox-ODI-Demo
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[#163d6d] pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-mono">{label}</span>
      <span className="text-slate-200 font-medium">{value}</span>
    </div>
  );
}
