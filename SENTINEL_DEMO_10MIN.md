# Sentinel — 10-Minute ODI Demo (SE script)

US bank-risk persona built on the Dropbox-ODI-Demo. Audience: CDO or CRO at
a regional bank, a bank-watch firm (Promontory, Kroll), or a state banking
regulator. Stack: Dropbox (primary) + FDIC API (fallback) → Snowflake →
dbt labs → Sentinel.

---

## The one sentence I'm selling

> Fivetran ODI doesn't ask the business to change how it shares data — it
> adopts the shared drive as a governed source. 583 files in a Dropbox
> folder become Iceberg-shaped tables in Snowflake, dbt labs canonicalizes
> them on both edges, and the answer to "which banks are about to fail"
> reads off a tested gold layer that any of five engines can query.

---

## The audience

- CDO/CRO at a regional bank, fintech, or bank-watch firm. They live in
  spreadsheets, regulatory PDFs, and the occasional SQL Server dump. Their
  failure mode is the same one every bank had in March 2023: the
  early-warning signal was in their data, just not in their dashboard.
- Title clue: if they say "the data engineering team," lead with
  Bronze/Silver/Gold. If they say "the risk team," lead with risk_score
  and quarterly trend.

## The setup line (verbatim)

> "Here's a shared Dropbox folder with 583 files dumped in over the years —
> spreadsheets, presentations, SQL Server backups, the works. Let's see
> what Fivetran ODI does with it."

That's the whole frame. No connector pitch, no architecture slide up front.
The demo earns the architecture page by minute 7.

## Pre-flight (T-5 min)

- `npm run dev` against the committed snapshot — site loads in <2s.
- Zoom 110%. Notifications off. Close Slack.
- Confirm `/architecture` engine tabs all swap query text.
- If the call is over Zoom, share the browser, not the desktop.

---

## Minute-by-minute (0:00 → 10:00)

### 0:00 — `/` — KPI tiles land (45 sec)

Open the homepage. Tiles fly in.

> "Top-of-page numbers — 150 institutions in the cohort, $15T in deposits,
> 583 files cataloged, 1.16% five-year failure rate. Everything you're
> looking at reads from a Snowflake gold layer that dbt labs built and
> tested before we walked in here. We're going to walk that pipeline back
> to its source, but I want you to see the destination first."

Hover the "Top States by Deposits" tile briefly. Move on.

### 1:00 — File inventory chart (1 min)

Scroll down to the file-inventory chart on `/`.

> "583 files, 76 GB, 44 distinct formats. CSVs and Excel — predictable.
> But also 78 SQL Server `.mdf` and `.ldf` files, 63 PowerPoints, 44 PDFs,
> a few `.bak` dumps. **Fivetran cataloged every one of them.** The tabular
> formats land as bronze tables. The non-tabular ones — PDFs, decks,
> database backups — get metadata rows so they're still discoverable. That
> matters because the answer to 'is this folder under control' has to
> include the files we can't parse, not just the ones we can."

### 2:00 — `/catalog` — Search "FDIC" (1 min)

Click into `/catalog`. Search box → type `FDIC` (or `call_report`).

> "Ninety-plus files matching. The badge column tells me which ones became
> parsed bronze tables and which ones are metadata-only — `.mdf` files for
> example, we know they exist, we know who owns them, we know their size,
> but the bytes aren't decoded. That's a deliberate choice — ODI doesn't
> pretend to understand a SQL Server backup file. It catalogs the existence
> of it so your team can decide what to do."

Filter by domain → "FinServ" → ~220 files.

### 3:00 — `/institutions` — Risk-sorted (1 min)

`/institutions` → sort by `risk_score` desc.

> "150 institutions, ranked. The top of the list is sitting in the
> elevated and high tiers — score above 50. This isn't a black-box
> ranking — it's a dbt model with versioned logic and tests. If your
> credit committee asks 'why is this bank above that bank,' the answer is
> in the lineage, not in a vendor's algorithm."

Point at the top 5.

### 4:00 — Institution drill-down (1 min)

Click into a high-risk institution (the first elevated/high one).

> "Eight quarters of capital ratio, charge-offs, ROA. The trend matters
> more than the snapshot. Peer failures in the same state, same charter
> class — and the AI summary at the top is a 3-sentence read written off
> the gold-layer numbers. **Not a vector summary of PDFs. A text generation
> off tested marts.** Same data the credit committee gets, just narrated."

If they raise "is this generative AI hallucinating" — answer:
> "It's templated against the columns you see below. The numbers in the
> summary equal the numbers on the page. The model writes the prose. dbt
> writes the truth."

### 5:00 — `/states` — Heatmap (1 min)

`/states` → state-grid heatmap.

> "Florida, top of the risk index. Click in."

Click FL → side panel populates with FL deposits, branches, failed banks
last 5y.

> "Eight Florida-chartered institutions failed in the last 5 years. The
> risk index is a composite — failure rate, deposit concentration, regional
> bias. The composition is dbt code. **If your model-risk committee wants
> to change the weights, they change a `.sql` file, they don't escalate to
> a vendor.**"

Click GA or IL for a second beat if time allows.

### 6:00 — `/pipeline` — observability (1 min)

`/pipeline` page.

> "Four layers. Bronze landed by Fivetran. Silver and gold built by dbt
> labs — and yes, that's both edges, dbt is the canonical layer on the way
> in *and* on the way out. 97 tests, 96 passing, last run 12 minutes ago.
> Three connectors: Dropbox primary, FDIC API as a fallback for the
> regulator data, synthetic generator for offline demos. They land into
> the same bronze schema."

If they ask about the one failing test:
> "Drift on a deposit total that doesn't reconcile to the FDIC report
> tolerance. The failure is logged but the gold layer didn't promote the
> bad row — that's the contract."

Optional: click "Simulate failure" → show the layer go red, then back
to green. Demonstrates observability. Skip if running tight.

### 7:00 — `/architecture` — THE money slide (90 sec)

`/architecture`. Scroll to the diagram. **Slow down here.**

> "This is the page I want you to remember after the call. Dropbox on the
> left — the shared folder we started with. Fivetran's custom connector
> lands files into Snowflake bronze. **dbt labs on the bronze-to-silver
> edge, dbt labs on the silver-to-gold edge** — same product, the canon
> on both transformations, since the merger that's one company. Gold
> tables live in Snowflake but they're shaped to be queryable from
> anything that speaks SQL."

Tab through the five engines:

> "Same gold table. Snowflake query — fast, default. Databricks SQL —
> works, same Iceberg-shaped tables. Athena via external table —
> works. DuckDB on the parquet exports — works for an analyst's laptop.
> Snowflake Cortex for the AI calls. **Storage is open. Catalog is open.
> Compute is a choice.** That's ODI."

### 8:00 — The ODI thesis (45 sec)

Sit on the architecture page. No clicks.

> "The thesis of Open Data Infrastructure is short. Three things —
> storage, catalog, compute — used to be one vendor's stack. ODI says
> they're independently swappable open standards. Iceberg or Delta for
> storage. Glue or Polaris or Unity for catalog. Snowflake or Athena or
> Spark or DuckDB or Cortex for compute. **The minute any of those three
> becomes a lock-in, you've stopped doing ODI and started doing the
> warehouse you said you didn't want.**"

> "What Sentinel just showed you — institutions, failures, state risk,
> file inventory — every page reads off open tables. The day you swap
> the engine, the dashboards don't change. The day you swap the
> catalog, the tests don't change. **That's the property regulators are
> going to require and you're going to want anyway.**"

### 9:00 — Q&A primers (60 sec)

Three likely questions. Pick the one that fits.

**Q: "But we already have Snowflake. Why ODI?"**
> "You haven't lost Snowflake. Snowflake is one of the engines on
> the architecture page — and the default in this demo. ODI is the
> property that the next engine doesn't require a migration. When your
> data-science team wants Databricks and your accountant wants DuckDB on
> a laptop, the gold tables are already there. You bought optionality,
> not a replacement."

**Q: "What about all the non-tabular files — the PDFs and SQL Server dumps?"**
> "Cataloged, not parsed. The bronze `_files` table has every row. When
> your team is ready to parse a `.mdf` — for example, with a Snowpark UDF
> or a Lambda — you add it. The catalog already knows the file exists
> and where it came from. ODI's claim isn't 'we read everything.' It's
> 'nothing is invisible to the canon.'"

**Q: "How is this different from just running dbt on top of Snowflake?"**
> "Two things. One — dbt labs *is* the company now after the merger, so
> the canonical layer and the platform underneath it have one roadmap.
> Two — the gold tables aren't Snowflake-only. The architecture page
> just showed you five engines reading them. If you put dbt on a
> warehouse-locked gold, you've solved governance and re-bought lock-in.
> ODI removes that."

### 10:00 — Close (handoff)

> "That's the ten. The shared-drive starting point was the real story
> here — Fivetran didn't ask anyone at the bank to change how they share
> files. It adopted the folder. dbt labs made the meaning consistent.
> Snowflake stored it. And five engines can query the result. Where do
> you want to dig in?"

Hand back to AE.

---

## Talking-points cheat sheet (10 one-liners)

1. "Shared drives are 80% of where real customer data still lives. ODI
   adopts them — without asking the business to change how it shares."
2. "Fivetran cataloged 583 files in 44 formats. The 44 includes the
   formats we can't parse — that's deliberate, not a gap."
3. "Bronze, silver, gold — Fivetran lands the bronze, dbt labs canonicalizes
   the other two. One vendor on both edges, since the merger."
4. "The risk score is dbt code. If your model-risk committee wants to
   change the weights, they change SQL. They don't call a vendor."
5. "97 tests guard the gold layer. The one failing test caught a deposit
   total that didn't reconcile — the bad row never reached the app."
6. "Cataloged isn't the same as parsed. `.mdf` files are present in the
   catalog as metadata. Your team decides when to decode them."
7. "Storage is open, catalog is open, compute is a choice. The minute
   any of those becomes a lock-in, you've stopped doing ODI."
8. "Five engines query the same gold table. Snowflake's the default in
   this demo. Swap any of them — the dashboards don't change."
9. "AI on a black box is the problem. AI on a governed, tested,
   lineage-tracked lake is the answer. Sentinel's summary reads numbers
   off the same marts the dashboard does."
10. "The FDIC API connector exists because Dropbox can block downloads on
    a shared link. ODI's job is to keep the demo — and the production
    pipeline — running when any one source breaks."

---

## Likely objections + responses

| They say | You say |
|---|---|
| "We're a Databricks shop — why are you showing Snowflake?" | "Snowflake's the default in this build. The architecture page has a Databricks tab on the same gold tables. You don't migrate; you point. ODI's whole pitch is the engine doesn't dictate the data." |
| "Dropbox sources aren't real enterprise data — show me ERP." | "Agreed that ERP matters. The same connector pattern lands SAP, Oracle, NetSuite. Dropbox is in this demo because it's the source that customers most often *underestimate* — and where shadow data lives. Pick any source and the silver/gold story is identical." |
| "We can do this with vanilla dbt on Snowflake." | "You can do the transformation half. You can't do the part where the gold tables are also queryable from Databricks, Athena, DuckDB, and Cortex without copies. The lock-in shows up the next time someone wants a non-Snowflake engine." |
| "What happens when the Dropbox folder structure changes?" | "Bronze tracks the folder via a cursor + rev hash. A new file lands as a new bronze table. A renamed file lands as a new row with a `superseded_by` reference. The silver staging models are the contract — if the underlying file shape changes in a way that breaks them, the test fails and gold doesn't update." |
| "How do you handle PII in the shared drive?" | "Two answers. One — the catalog flags every file's domain (FinServ, Healthcare, etc.) so PII-bearing files get a different lifecycle. Two — dbt has column-level lineage and PII tags on the silver edges. If a column is PII, it doesn't leak into a gold mart that's published to an AI agent unless the agent has the right role. Snowflake row-access policies enforce it at query time." |

---

## Hard guardrails

- Lead with the destination + persona app. **Never open the Fivetran sync
  UI to a CDO/CRO buyer.** (User-memory rule: no UI-led senior demos.)
- Always say "dbt labs" — never just "dbt." The merger is the point.
- The architecture diagram must show **dbt labs on BOTH bronze→silver
  and silver→gold edges** every time. (User-memory rule.)
- Don't quote the FDIC failure-rate stat as if it's the whole story —
  it's a directional number, not a regulatory filing.
- Don't oversell synthetic data. If asked, say: "this is reproducible
  synthetic FDIC-shaped data so the demo runs offline; the live path
  pulls the same shapes from Snowflake."
- Don't promise "we read every file" — the catalog is the truth: some
  parsed, some metadata-only.

---

## If they steer the conversation

| They raise | You go |
|---|---|
| "Our pain isn't ingestion, it's mapping" | `/architecture` — dbt labs on both edges. Reusable canonical models, semantic layer, mapping logic versioned in git. |
| "How does this compare to Databricks Lakehouse / Snowflake Iceberg?" | Both are engines in the architecture page. Iceberg under the hood. The point isn't to pick one — it's to make them swappable. |
| "AI / Cortex / Claude" | The institution detail page's AI summary. Templated off marts. Not a vector blob. |
| "Procurement / security review" | "Fivetran is already through your procurement cycle for the existing connectors — extending to a new connector doesn't restart the clock." |
| "What about real-time?" | "Bronze refresh cadence is set by the connector. Most shared-drive sources are hourly or daily — that's appropriate. If a source needs CDC, Fivetran has it; ODI doesn't change that." |
| "Show me lineage" | `/architecture` → scroll to the dbt-emitted lineage panel. Column-level. Auto-generated on every build. |
