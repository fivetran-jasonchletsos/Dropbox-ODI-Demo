import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(0x5e07171);

function pick(arr) { return arr[Math.floor(rand() * arr.length)]; }
function range(min, max) { return min + rand() * (max - min); }
function ri(min, max) { return Math.floor(range(min, max + 1)); }
function gauss(mu, sigma) {
  const u = 1 - rand();
  const v = rand();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const STATES = [
  ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
  ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
  ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
  ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
  ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
  ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
  ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
  ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
  ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
  ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
  ['DC','District of Columbia'],['PR','Puerto Rico'],
];

const STATE_WEIGHTS = {
  CA: 0.11, TX: 0.09, NY: 0.085, FL: 0.07, IL: 0.045, PA: 0.04, OH: 0.038, GA: 0.033,
  NC: 0.032, NJ: 0.030, VA: 0.029, MA: 0.027, WA: 0.026, MI: 0.024, MD: 0.022,
};

const CITIES_BY_STATE = {
  CA: ['Los Angeles','San Francisco','San Diego','Sacramento','San Jose','Oakland','Fresno','Long Beach'],
  TX: ['Houston','Dallas','Austin','San Antonio','Fort Worth','El Paso','Arlington','Plano'],
  NY: ['New York','Buffalo','Rochester','Syracuse','Albany','White Plains','Yonkers'],
  FL: ['Miami','Orlando','Tampa','Jacksonville','Tallahassee','Fort Lauderdale','St. Petersburg'],
  IL: ['Chicago','Springfield','Naperville','Aurora','Peoria','Rockford'],
  PA: ['Philadelphia','Pittsburgh','Harrisburg','Allentown','Erie','Scranton'],
  OH: ['Columbus','Cleveland','Cincinnati','Toledo','Akron','Dayton'],
  GA: ['Atlanta','Savannah','Augusta','Macon','Columbus','Athens'],
  NC: ['Charlotte','Raleigh','Greensboro','Durham','Winston-Salem','Asheville'],
  NJ: ['Newark','Jersey City','Paterson','Elizabeth','Edison','Trenton'],
  VA: ['Richmond','Virginia Beach','Norfolk','Arlington','Alexandria','Chesapeake'],
  MA: ['Boston','Worcester','Springfield','Cambridge','Lowell','Brockton'],
  WA: ['Seattle','Spokane','Tacoma','Vancouver','Bellevue','Kent'],
  MI: ['Detroit','Grand Rapids','Lansing','Ann Arbor','Flint','Warren'],
};

function cityFor(state) {
  if (CITIES_BY_STATE[state]) return pick(CITIES_BY_STATE[state]);
  return pick(['Riverside','Plainview','Fairview','Lakeside','Greenfield','Bridgeport','Springfield','Madison','Franklin','Clinton']);
}

function pickState() {
  const r = rand();
  let acc = 0;
  for (const [s, w] of Object.entries(STATE_WEIGHTS)) {
    acc += w;
    if (r < acc) return s;
  }
  const rest = STATES.map(([s]) => s).filter(s => !STATE_WEIGHTS[s]);
  return pick(rest);
}

const NAME_PREFIXES = [
  'First','Citizens','Heritage','Pinnacle','Liberty','Founders','Cornerstone','United','Sentinel','Patriot',
  'Mercantile','Sterling','Cardinal','Summit','Beacon','Valley','Coastal','Midwest','Pacific','Atlantic',
  'Mountain','Prairie','River','Harbor','Capital','Frontier','Independence','Commonwealth','Plains','Lake',
];
const NAME_PLACES = [
  'Trust','National','Federal','Savings','Community','State','Republic','Mutual','Exchange','Commerce',
  'Banking','Financial','Holdings','Partners','Group','Holdings',
];

function fakeBankName(state) {
  const stateName = STATES.find(([s]) => s === state)?.[1] ?? '';
  const styles = [
    () => `${pick(NAME_PREFIXES)} ${pick(NAME_PLACES)} Bank`,
    () => `${pick(NAME_PREFIXES)} Bank of ${stateName}`,
    () => `${pick(NAME_PREFIXES)} ${pick(NAME_PLACES)}`,
    () => `${stateName} ${pick(['First','National','Heritage','Sterling','Pinnacle'])} Bank`,
    () => `${pick(NAME_PREFIXES)} & ${pick(NAME_PREFIXES)} ${pick(['Bank','Trust','Savings'])}`,
  ];
  return pick(styles)();
}

const CHARTERS = ['N','NM','SM','SB','SA'];
const CHARTER_WEIGHTS = [0.32, 0.38, 0.12, 0.10, 0.08];
function pickCharter() {
  const r = rand();
  let acc = 0;
  for (let i = 0; i < CHARTERS.length; i++) {
    acc += CHARTER_WEIGHTS[i];
    if (r < acc) return CHARTERS[i];
  }
  return 'NM';
}

const ASSET_CLASSES = ['<100M','100M-1B','1B-10B','10B-100B','>100B'];
const ASSET_WEIGHTS = [0.20, 0.46, 0.24, 0.085, 0.015];
function pickAssetClass() {
  const r = rand();
  let acc = 0;
  for (let i = 0; i < ASSET_CLASSES.length; i++) {
    acc += ASSET_WEIGHTS[i];
    if (r < acc) return ASSET_CLASSES[i];
  }
  return '100M-1B';
}

function depositsForAsset(ac) {
  switch (ac) {
    case '<100M': return range(0.01, 0.099);
    case '100M-1B': return range(0.1, 0.999);
    case '1B-10B': return range(1, 9.99);
    case '10B-100B': return range(10, 99.99);
    case '>100B': return range(120, 2400);
  }
  return 0.5;
}

function branchesForDeposits(d) {
  if (d >= 500) return ri(2400, 4900);
  if (d >= 100) return ri(400, 2400);
  if (d >= 10) return ri(40, 380);
  if (d >= 1) return ri(8, 90);
  if (d >= 0.1) return ri(2, 14);
  return ri(1, 4);
}

function tierFromScore(s) {
  if (s < 30) return 'low';
  if (s < 55) return 'watch';
  if (s < 75) return 'elevated';
  return 'high';
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function round(x, d = 2) { const k = 10 ** d; return Math.round(x * k) / k; }

const NOW = new Date('2026-05-15T18:30:00Z');
function iso(d) { return d.toISOString(); }
function isoDate(d) { return d.toISOString().slice(0, 10); }
function shiftHours(d, h) { return new Date(d.getTime() - h * 3600_000); }
function shiftDays(d, days) { return new Date(d.getTime() - days * 86400_000); }

const N_INSTITUTIONS = 150;
const institutions = [];
const certs = new Set();
function newCert() {
  let c;
  do { c = String(10000 + ri(0, 89999)); } while (certs.has(c));
  certs.add(c);
  return c;
}

for (let i = 0; i < N_INSTITUTIONS; i++) {
  const state = pickState();
  const charter = pickCharter();
  const assetClass = pickAssetClass();
  const deposits = depositsForAsset(assetClass);
  const branches = branchesForDeposits(deposits);

  let baseRisk = gauss(28, 18);
  if (deposits < 0.2) baseRisk += 8;
  if (deposits > 80) baseRisk -= 6;
  if (charter === 'SA' || charter === 'SB') baseRisk += 5;
  const risk = clamp(Math.round(baseRisk), 2, 96);

  const capital = clamp(gauss(12.4, 1.8) - (risk - 30) * 0.04, 5.5, 22);
  const nco = clamp(gauss(0.45, 0.35) + (risk - 30) * 0.012, 0.02, 4.5);
  const roa = clamp(gauss(1.05, 0.55) - (risk - 30) * 0.012, -1.8, 2.5);

  institutions.push({
    cert_id: newCert(),
    name: fakeBankName(state),
    city: cityFor(state),
    state,
    charter_class: charter,
    asset_class: assetClass,
    deposits_b: round(deposits, 3),
    branches,
    established_year: ri(1880, 2018),
    risk_score: risk,
    risk_tier: tierFromScore(risk),
    capital_ratio_pct: round(capital, 2),
    net_charge_off_ratio_pct: round(nco, 2),
    return_on_assets_pct: round(roa, 2),
  });
}

institutions.sort((a, b) => b.deposits_b - a.deposits_b);

// === Failures ===
const FAMOUS_FAILURES = [
  { name: 'Washington Mutual Bank', city: 'Henderson', state: 'NV', close_date: '2008-09-25', acquirer: 'JPMorgan Chase Bank, N.A.', charter_class: 'SA' },
  { name: 'IndyMac Bank, F.S.B.', city: 'Pasadena', state: 'CA', close_date: '2008-07-11', acquirer: 'OneWest Bank, FSB', charter_class: 'SA' },
  { name: 'Silicon Valley Bank', city: 'Santa Clara', state: 'CA', close_date: '2023-03-10', acquirer: 'First-Citizens Bank & Trust Company', charter_class: 'SM' },
  { name: 'Signature Bank', city: 'New York', state: 'NY', close_date: '2023-03-12', acquirer: 'Flagstar Bank, N.A.', charter_class: 'NM' },
  { name: 'First Republic Bank', city: 'San Francisco', state: 'CA', close_date: '2023-05-01', acquirer: 'JPMorgan Chase Bank, N.A.', charter_class: 'NM' },
  { name: 'Silvergate Bank', city: 'La Jolla', state: 'CA', close_date: '2023-03-08', acquirer: 'Voluntary liquidation', charter_class: 'NM' },
  { name: 'Heritage Bank', city: 'Tinley Park', state: 'IL', close_date: '2014-11-07', acquirer: 'MB Financial Bank, N.A.', charter_class: 'SM' },
  { name: 'Heritage Bank of Florida', city: 'Lutz', state: 'FL', close_date: '2014-06-06', acquirer: 'Centennial Bank', charter_class: 'NM' },
  { name: 'Republic First Bank', city: 'Philadelphia', state: 'PA', close_date: '2024-04-26', acquirer: 'Fulton Bank, N.A.', charter_class: 'SM' },
  { name: 'Heartland Tri-State Bank', city: 'Elkhart', state: 'KS', close_date: '2023-07-28', acquirer: 'Dream First Bank, N.A.', charter_class: 'N' },
];

const FAIL_REASONS = [
  'Liquidity crisis from depositor outflows',
  'Concentrated CRE exposure deteriorated',
  'Capital deficiency under PCA',
  'Operational losses from fraud',
  'Crypto-sector deposit run',
  'Tech-sector deposit concentration',
  'Asset-liability mismatch',
  'Mortgage book impairment',
];

const failures = [];
for (const f of FAMOUS_FAILURES) {
  failures.push({
    cert_id: newCert(),
    name: f.name,
    city: f.city,
    state: f.state,
    close_date: f.close_date,
    fund: 'DIF',
    acquirer: f.acquirer,
    charter_class: f.charter_class,
  });
}
const yearWeights = {
  2008: 25, 2009: 140, 2010: 157, 2011: 92, 2012: 51, 2013: 24, 2014: 18, 2015: 8,
  2016: 5, 2017: 8, 2018: 0, 2019: 4, 2020: 4, 2021: 0, 2022: 0, 2023: 3, 2024: 2, 2025: 1,
};
for (const [yearStr, count] of Object.entries(yearWeights)) {
  const year = parseInt(yearStr, 10);
  for (let i = 0; i < count; i++) {
    const state = pickState();
    const month = ri(1, 12);
    const day = ri(1, 28);
    failures.push({
      cert_id: newCert(),
      name: fakeBankName(state),
      city: cityFor(state),
      state,
      close_date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
      fund: 'DIF',
      acquirer: rand() < 0.85 ? fakeBankName(state) : 'No Acquirer (DIF Payout)',
      charter_class: pickCharter(),
    });
  }
}
failures.sort((a, b) => b.close_date.localeCompare(a.close_date));

// === State risk ===
const stateRisk = STATES.map(([state, state_name]) => {
  const stInsts = institutions.filter(i => i.state === state);
  const totalDeposits = stInsts.reduce((a, b) => a + b.deposits_b, 0);
  const totalBranches = stInsts.reduce((a, b) => a + b.branches, 0);
  const stFails5y = failures.filter(f => f.state === state && f.close_date >= '2021-01-01').length;
  const rate = stInsts.length > 0 ? (stFails5y / Math.max(1, stInsts.length)) * 100 : 0;
  const avgRisk = stInsts.length ? stInsts.reduce((a, b) => a + b.risk_score, 0) / stInsts.length : 30;
  const failBoost = Math.min(40, stFails5y * 6);
  const riskIndex = clamp(Math.round(avgRisk * 0.7 + failBoost + (rand() * 8 - 4)), 6, 92);
  return {
    state,
    state_name,
    total_deposits_b: round(totalDeposits, 2),
    total_branches: totalBranches,
    total_institutions: stInsts.length,
    failed_count_5y: stFails5y,
    failure_rate_pct_5y: round(rate, 2),
    risk_index: riskIndex,
  };
});

// === Summary ===
const topStates = [...stateRisk].sort((a, b) => b.total_deposits_b - a.total_deposits_b).slice(0, 10).map(s => ({ state: s.state, deposits_b: s.total_deposits_b }));

const fileExts = [
  ['csv', 130], ['xlsx', 68], ['pptx', 63], ['pdf', 44], ['ldf', 39], ['mdf', 39], ['zip', 35],
  ['docx', 35], ['txt', 29], ['7z', 13], ['dmp', 10], ['doc', 10], ['xls', 8], ['sql', 6],
  ['ppt', 6], ['xml', 5], ['gz', 4], ['json', 4], ['parquet', 3], ['png', 3], ['rtf', 2],
  ['md', 2], ['tsv', 2], ['log', 2], ['bak', 2], ['key', 2], ['pages', 1], ['numbers', 1],
  ['avro', 1], ['orc', 1], ['yaml', 1], ['db', 1], ['accdb', 1], ['ipynb', 1], ['xz', 1], ['tar', 1],
];
const _extTotal = fileExts.reduce((a, [, c]) => a + c, 0);
// adjust to 583
const adj = 583 - _extTotal;
if (adj !== 0) fileExts[0][1] += adj;

const fileDomains = [
  ['FinServ', 132], ['Healthcare', 98], ['Retail', 87], ['HigherEd', 74],
  ['Manufacturing', 81], ['Macro', 65], ['Other', 46],
];

const nationalFailureTrend = Object.entries(yearWeights).map(([y, c]) => ({ year: parseInt(y, 10), count: c }));

const lastBuilds = {
  bronze: iso(shiftHours(NOW, 2.5)),
  silver: iso(shiftHours(NOW, 1.5)),
  gold:   iso(shiftHours(NOW, 0.5)),
};

const summary = {
  total_institutions: 4503,
  total_deposits_b: 18412.6,
  total_branches: 74938,
  total_failed_banks_since_2008: failures.length,
  failure_rate_pct_5y: 0.42,
  top_states_by_deposits: topStates,
  file_inventory: {
    total_files: 583,
    total_bytes: 76509727685,
    by_ext: fileExts.map(([ext, count]) => ({ ext, count })),
    by_domain: fileDomains.map(([domain, count]) => ({ domain, count })),
  },
  pipeline_status: [
    { layer: 'bronze', table_count: 47, row_count: 184_226_104, last_built_at: lastBuilds.bronze },
    { layer: 'silver', table_count: 28, row_count: 142_009_558, last_built_at: lastBuilds.silver },
    { layer: 'gold',   table_count: 12, row_count:  18_645_201, last_built_at: lastBuilds.gold   },
  ],
  last_synced_at: iso(NOW),
  national_failure_trend: nationalFailureTrend,
};

// === Institution details ===
function aiSummaryFor(inst) {
  const tierLine = inst.risk_tier === 'low'
    ? 'remains well-capitalized with healthy earnings'
    : inst.risk_tier === 'watch'
      ? 'shows early-warning indicators but capital coverage is adequate'
      : inst.risk_tier === 'elevated'
        ? 'is operating with deteriorating credit metrics worth monitoring'
        : 'is materially distressed with capital ratios trending toward PCA thresholds';
  const fail = inst.risk_tier === 'high' || inst.risk_tier === 'elevated'
    ? ` Peer failures in ${inst.state} since 2021 suggest elevated regional stress.`
    : '';
  return `${inst.name} (${inst.city}, ${inst.state}) holds $${inst.deposits_b.toFixed(2)}B in deposits across ${inst.branches} branches and ${tierLine}. Capital ratio of ${inst.capital_ratio_pct.toFixed(2)}% and ROA of ${inst.return_on_assets_pct.toFixed(2)}% benchmark this institution against ${inst.asset_class} peers.${fail}`;
}

function quarterlySeries(inst) {
  const quarters = [];
  let dep = inst.deposits_b * range(0.85, 0.95);
  let npl = clamp(inst.net_charge_off_ratio_pct * range(0.7, 1.0) + 0.2, 0.1, 5);
  let cap = inst.capital_ratio_pct + range(-1.5, 1.0);
  const startQ = { year: 2024, q: 2 };
  for (let i = 0; i < 8; i++) {
    const y = startQ.year + Math.floor((startQ.q - 1 + i) / 4);
    const q = ((startQ.q - 1 + i) % 4) + 1;
    dep += dep * range(-0.04, 0.06);
    npl = clamp(npl + range(-0.08, 0.12) + (inst.risk_score - 35) * 0.0015, 0.1, 6);
    cap = clamp(cap + range(-0.4, 0.35), 5, 22);
    quarters.push({
      q: `Q${q} ${y}`,
      deposits_b: round(dep, 3),
      npl_ratio: round(npl, 2),
      capital_ratio: round(cap, 2),
    });
  }
  return quarters;
}

function detailFor(inst) {
  const branchTotal = inst.branches;
  const primaryShare = 0.55 + rand() * 0.30;
  const primary = Math.round(branchTotal * primaryShare);
  const otherStates = STATES
    .filter(([s]) => s !== inst.state)
    .sort(() => rand() - 0.5)
    .slice(0, ri(2, 5));
  const branchesByState = [{ state: inst.state, count: primary, deposits_b: round(inst.deposits_b * primaryShare, 3) }];
  let rem = branchTotal - primary;
  let remDep = inst.deposits_b * (1 - primaryShare);
  for (let i = 0; i < otherStates.length; i++) {
    const last = i === otherStates.length - 1;
    const share = last ? 1 : range(0.2, 0.5);
    const c = last ? rem : Math.max(1, Math.round(rem * share));
    const d = last ? remDep : remDep * share;
    branchesByState.push({ state: otherStates[i][0], count: c, deposits_b: round(d, 3) });
    rem -= c;
    remDep -= d;
  }

  const sameStateFails = failures.filter(f => f.state === inst.state).slice(0, 4);
  const peer = sameStateFails.map(f => ({
    name: f.name,
    close_date: f.close_date,
    charter_class: f.charter_class,
    reason: pick(FAIL_REASONS),
  }));

  return {
    ...inst,
    branches_by_state: branchesByState,
    peer_failures: peer,
    quarterly: quarterlySeries(inst),
    ai_summary: aiSummaryFor(inst),
  };
}

// === Pipeline ===
const bronzeTables = [
  ['raw_failed_banks', 564, ['raw_failed_banks.csv']],
  ['raw_summary_of_deposits', 86421, []],
  ['raw_institutions', 4503, []],
  ['raw_branches', 74938, []],
  ['raw_call_reports_q1', 4501, []],
  ['raw_call_reports_q2', 4493, []],
  ['raw_dropbox_files', 583, []],
  ['raw_dropbox_xlsx', 68, []],
  ['raw_dropbox_csv', 130, []],
  ['raw_dropbox_pdf', 44, []],
  ['raw_dropbox_sql_dumps', 49, []],
  ['raw_state_pop', 51, []],
  ['raw_fed_rates_history', 2884, []],
  ['raw_treasury_yields', 14210, []],
];

const silverTables = [
  ['inst_clean', 4503, ['raw_institutions','raw_call_reports_q2']],
  ['failed_banks_clean', 564, ['raw_failed_banks']],
  ['deposits_by_branch', 74938, ['raw_branches','raw_summary_of_deposits']],
  ['quarterly_metrics', 36020, ['raw_call_reports_q1','raw_call_reports_q2']],
  ['inst_geo_enriched', 4503, ['inst_clean','raw_state_pop']],
  ['file_inventory_clean', 583, ['raw_dropbox_files']],
  ['failure_history_by_state', 51, ['failed_banks_clean']],
  ['peer_groups', 4503, ['inst_clean']],
  ['macro_rates_daily', 12550, ['raw_fed_rates_history','raw_treasury_yields']],
];

const goldTables = [
  ['dim_institution', 4503, ['inst_clean','peer_groups']],
  ['fact_quarterly_metrics', 36020, ['quarterly_metrics','inst_clean']],
  ['fact_failed_banks', 564, ['failed_banks_clean']],
  ['agg_state_risk', 51, ['failure_history_by_state','inst_geo_enriched']],
  ['agg_file_inventory', 583, ['file_inventory_clean']],
  ['mart_institution_risk_score', 4503, ['dim_institution','fact_quarterly_metrics','agg_state_risk']],
  ['mart_branch_geography', 74938, ['deposits_by_branch','dim_institution']],
  ['mart_failure_trend', 96, ['fact_failed_banks']],
];

const pipeline = {
  source: {
    connector: 'dropbox',
    folder: '/Shared/ODI Sandbox',
    file_count: 583,
    last_run: iso(shiftHours(NOW, 3)),
  },
  layers: {
    bronze: {
      tables: bronzeTables.map(([name, rows]) => ({
        name, rows, updated_at: iso(shiftHours(NOW, range(2.5, 4))),
      })),
      status: 'ok',
    },
    silver: {
      tables: silverTables.map(([name, rows, depends_on]) => ({
        name, rows, updated_at: iso(shiftHours(NOW, range(1.5, 2.5))), depends_on,
      })),
      status: 'ok',
    },
    gold: {
      tables: goldTables.map(([name, rows, depends_on]) => ({
        name, rows, updated_at: iso(shiftHours(NOW, range(0.3, 1.3))), depends_on,
      })),
      status: 'ok',
    },
  },
  recent_events: [
    { ts: iso(shiftHours(NOW, 0.05)), level: 'info', msg: 'Gold layer rebuild completed in 84s · 12 models, 0 failures' },
    { ts: iso(shiftHours(NOW, 0.35)), level: 'info', msg: 'dbt run silver: 28 models OK · slowest: peer_groups (12.4s)' },
    { ts: iso(shiftHours(NOW, 0.6)),  level: 'warn', msg: 'Schema drift detected on raw_dropbox_xlsx: 3 new columns auto-promoted' },
    { ts: iso(shiftHours(NOW, 1.1)),  level: 'info', msg: 'Fivetran sync committed 583 files (+12 new) from Dropbox /Shared/ODI Sandbox' },
    { ts: iso(shiftHours(NOW, 1.7)),  level: 'info', msg: 'Bronze ingest: 184.2M rows landed in Iceberg, manifest committed' },
    { ts: iso(shiftHours(NOW, 2.3)),  level: 'warn', msg: 'raw_dropbox_sql_dumps: 4 MDF files require manual unwrap (skipped this run)' },
    { ts: iso(shiftHours(NOW, 3.2)),  level: 'info', msg: 'FDIC public-API delta: +18 quarterly call-reports, +2 failure events' },
    { ts: iso(shiftHours(NOW, 4.8)),  level: 'error', msg: 'Stale file detected: BankReviews_v2.xlsx unchanged 47 days · parking in quarantine' },
    { ts: iso(shiftHours(NOW, 6.1)),  level: 'info', msg: 'Dropbox watcher attached: 583 files indexed, 76.5 GB total' },
    { ts: iso(shiftHours(NOW, 8.4)),  level: 'info', msg: 'Run-time agent AI summaries generated for 4,503 institutions (avg 312 ms)' },
  ],
};

// === Catalog ===
const REAL_NAMES = [
  ['FDIC Failed Bank List.csv','csv','FinServ',1.8],
  ['FDIC Summary of Deposits 2024.csv','csv','FinServ',38420],
  ['FDIC Institutions Q2 2026.csv','csv','FinServ',12300],
  ['Bank Reviews.xlsx','xlsx','FinServ',2840],
  ['Call Reports Q1 2026.csv','csv','FinServ',46800],
  ['Call Reports Q2 2026.csv','csv','FinServ',47200],
  ['Branch Locations Master.xlsx','xlsx','FinServ',8420],
  ['Peer Group Definitions.csv','csv','FinServ',420],
  ['Capital Adequacy Memo.pdf','pdf','FinServ',1240],
  ['CRA Examination Notes 2024.docx','docx','FinServ',880],
  ['BankReviews_v2.xlsx','xlsx','FinServ',2920],
  ['Stress Test Scenarios 2026.xlsx','xlsx','FinServ',1860],
  ['AmazonData.mdf','mdf','Retail',2_421_080],
  ['AmazonData_log.ldf','ldf','Retail',184_400],
  ['Sample_AmazonOrders.csv','csv','Retail',12420],
  ['Online Retail II.xlsx','xlsx','Retail',26840],
  ['CPG POS Tables-2.xls','xls','Retail',9840],
  ['POS Daily Extract 2024-12.csv','csv','Retail',88420],
  ['Storefront Inventory.parquet','parquet','Retail',412400],
  ['AutomotiveClaims3.0.zip','zip','Manufacturing',180_400],
  ['Manufacturing Defect Log.xlsx','xlsx','Manufacturing',3420],
  ['Plant Output Q4.pptx','pptx','Manufacturing',4860],
  ['ERP_Extract_2024.7z','7z','Manufacturing',428_400],
  ['Bill of Materials Master.csv','csv','Manufacturing',18420],
  ['Sample_PharmaProfit.xlsx','xlsx','Healthcare',6420],
  ['Patient Encounters 2024.csv','csv','Healthcare',128_400],
  ['HCAHPS Scores by Provider.xlsx','xlsx','Healthcare',8420],
  ['Claims Adjudication.sql','sql','Healthcare',12],
  ['EHR_Encounters_dump.mdf','mdf','Healthcare',1_812_400],
  ['EHR_Encounters_log.ldf','ldf','Healthcare',124_200],
  ['BIOSDT Overview.pdf','pdf','Healthcare',1840],
  ['Clinical Trial Cohort A.xlsx','xlsx','Healthcare',7240],
  ['Provider Directory.csv','csv','Healthcare',38420],
  ['WS3_T3_Taleo_Recruit.xlsx','xlsx','HigherEd',1240],
  ['Student Enrollment 2024-25.csv','csv','HigherEd',24800],
  ['Faculty Compensation.xlsx','xlsx','HigherEd',1840],
  ['Course Catalog Fall 2026.pdf','pdf','HigherEd',2640],
  ['Alumni Giving History.csv','csv','HigherEd',184_200],
  ['Research Grants Awarded.xlsx','xlsx','HigherEd',3840],
  ['Campus Facilities Audit.docx','docx','HigherEd',1240],
  ['SIS_Export_dump.mdf','mdf','HigherEd',2_184_200],
  ['SIS_Export_log.ldf','ldf','HigherEd',184_200],
  ['CPI All Urban Consumers.csv','csv','Macro',1840],
  ['Treasury Yield Curve Daily.csv','csv','Macro',8420],
  ['Fed Funds Rate History.csv','csv','Macro',4200],
  ['Unemployment by MSA.xlsx','xlsx','Macro',2840],
  ['GDP Quarterly Vintage.csv','csv','Macro',1240],
  ['Mortgage Origination Volume.xlsx','xlsx','Macro',6840],
  ['Recession Indicators.pdf','pdf','Macro',1640],
  ['ConsumerCreditOutlook.pptx','pptx','Macro',4240],
  ['M2 Money Supply.csv','csv','Macro',840],
  ['NotesFromBoardMeeting.docx','docx','Other',420],
  ['Old Backups.zip','zip','Other',180_400],
  ['Misc_Vendor_Quotes.pdf','pdf','Other',1240],
  ['archive_2019.7z','7z','Other',840_000],
  ['scratch.txt','txt','Other',12],
  ['ad-hoc-query.sql','sql','Other',4],
  ['team_offsite_2023.pptx','pptx','Other',12420],
  ['IT_Inventory.xlsx','xlsx','Other',1840],
  ['old_database.bak','bak','Other',482_400],
  ['Bank Holding Company Filings 2024.zip','zip','FinServ',184_200],
  ['CommercialLoanBook.xls','xls','FinServ',8420],
  ['Underwriting Standards.docx','docx','FinServ',840],
  ['NIM Trend Analysis.pptx','pptx','FinServ',4820],
  ['Deposit Concentration Report.xlsx','xlsx','FinServ',2840],
  ['Liquidity Coverage Ratio.csv','csv','FinServ',840],
  ['Net Charge-Off Detail.csv','csv','FinServ',12400],
  ['ALCO Meeting Materials.pptx','pptx','FinServ',6820],
  ['BSA AML Watchlist.csv','csv','FinServ',1820],
  ['Regulatory Examination Report.pdf','pdf','FinServ',1240],
  ['LoanLossAllowance.xlsx','xlsx','FinServ',2840],
  ['CRE Concentration Memo.docx','docx','FinServ',420],
  ['SVB Postmortem.pdf','pdf','FinServ',2840],
  ['Signature Bank Resolution Plan.pdf','pdf','FinServ',1840],
  ['First Republic Loss Estimates.xlsx','xlsx','FinServ',1240],
  ['FOMC Minutes Q1 2026.pdf','pdf','Macro',2240],
  ['Beige Book May 2026.pdf','pdf','Macro',1840],
  ['SLOOS Senior Loan Officer Survey.xlsx','xlsx','FinServ',1240],
  ['Credit Card Delinquency.csv','csv','FinServ',8420],
  ['Auto Loan ABS Performance.xlsx','xlsx','FinServ',6420],
  ['Mortgage Delinquency by State.csv','csv','FinServ',4200],
  ['HMDA Loan Application Register.csv','csv','FinServ',420_400],
  ['Y-9C Holding Company Reports.zip','zip','FinServ',184_400],
  ['Y-9C Schedule HC-K.csv','csv','FinServ',12420],
  ['BHC Risk Indicators.xlsx','xlsx','FinServ',2820],
  ['Branch_Closures_2024.csv','csv','FinServ',1820],
  ['Community Reinvestment Plan.docx','docx','FinServ',840],
  ['Diversity Snapshot 2025.pdf','pdf','Other',1240],
  ['Cyber Incident Reports.csv','csv','Other',420],
  ['Vendor Risk Assessment.xlsx','xlsx','Other',1240],
  ['Operational Loss Database.csv','csv','FinServ',12420],
  ['Fraud Investigation Files.zip','zip','FinServ',184_200],
  ['Customer Complaints Q1.csv','csv','FinServ',8420],
  ['Public Records Search.csv','csv','Other',2420],
  ['Counterparty Exposure.xlsx','xlsx','FinServ',6240],
  ['ALLL Methodology.pdf','pdf','FinServ',1840],
  ['ICE BofA HY Index.csv','csv','Macro',12420],
  ['Investment Securities Portfolio.xlsx','xlsx','FinServ',4820],
  ['HTM Unrealized Losses.csv','csv','FinServ',1240],
  ['AFS Mark to Market.xlsx','xlsx','FinServ',2820],
  ['Interest Rate Risk Memo.docx','docx','FinServ',840],
  ['Liquidity Stress Workbook.xlsx','xlsx','FinServ',8420],
  ['Recovery and Resolution Plan.pdf','pdf','FinServ',3840],
  ['Living Will Summary.docx','docx','FinServ',1240],
  ['Section 165 Filing.pdf','pdf','FinServ',2840],
  ['Pillar 3 Disclosures Q4.pdf','pdf','FinServ',4820],
  ['Basel III Capital Calc.xlsx','xlsx','FinServ',12400],
  ['CECL Forecast Q2.xlsx','xlsx','FinServ',8240],
  ['Hospital Census Daily.csv','csv','Healthcare',12420],
  ['Pharmacy Dispensing.csv','csv','Healthcare',38420],
  ['Insurance Claims 2024.csv','csv','Healthcare',184_200],
  ['Provider Network Adequacy.xlsx','xlsx','Healthcare',3240],
  ['HEDIS Quality Measures.csv','csv','Healthcare',6420],
  ['Vendor Master.csv','csv','Manufacturing',8420],
  ['Supply Chain KPIs.pptx','pptx','Manufacturing',4820],
  ['Defect Rate Trend.xlsx','xlsx','Manufacturing',2820],
  ['Plant Utilization Q3.csv','csv','Manufacturing',1820],
  ['Production Schedule.xlsx','xlsx','Manufacturing',3840],
  ['SAP_Export.7z','7z','Manufacturing',184_200],
  ['Inventory_Master_dump.mdf','mdf','Manufacturing',2_184_200],
  ['Inventory_Master_log.ldf','ldf','Manufacturing',124_200],
  ['Marketing Spend Plan.pptx','pptx','Retail',4820],
  ['SKU Performance.csv','csv','Retail',38420],
  ['Loyalty Program Members.csv','csv','Retail',124_200],
  ['Holiday Forecast 2026.xlsx','xlsx','Retail',3840],
  ['Returns and Refunds Q4.csv','csv','Retail',2420],
];

const catalog = [];
const usedNames = new Set();
for (const [name, ext, domain, size_kb] of REAL_NAMES) {
  if (usedNames.has(name)) continue;
  usedNames.add(name);
  catalog.push({ name, ext, size_kb, domain, parsed: rand() < 0.78, table_name: rand() < 0.65 ? `raw_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/,'').slice(0, 48)}` : undefined });
}

const filler_topics = [
  'BoardMinutes','VendorContract','LegalMemo','ITAudit','PolicyDoc','TrainingMaterials','SOXEvidence',
  'ProductLaunch','CustomerSegmentation','MarketingDeck','OperationsReview','ProcessFlow','RACIMatrix',
  'OrgChart','HRReview','PerformanceCalibration','BudgetVariance','ForecastModel','VarianceAnalysis',
  'StaffingPlan','RecruitingPipeline','ComplianceSurvey','AuditWorkpapers','RemediationTracker',
  'IncidentLog','ChangeRequest','ReleaseNotes','RoadmapDraft','VendorDueDiligence','SOC2Report',
  'PenTestResults','SecurityFindings','DataRetentionPolicy','ArchiveExport','LegacyExtract','SnapshotBackup',
];
const ext_pool = ['csv','xlsx','pptx','pdf','docx','txt','zip','xls','sql','ppt','xml','7z','ldf','mdf','dmp','gz','json'];
const ext_weights = [25, 14, 12, 9, 8, 7, 7, 4, 3, 3, 2, 2, 2, 2, 1, 0.5, 0.5];
function pickExt() {
  const total = ext_weights.reduce((a, b) => a + b, 0);
  let r = rand() * total;
  for (let i = 0; i < ext_pool.length; i++) {
    r -= ext_weights[i];
    if (r <= 0) return ext_pool[i];
  }
  return 'csv';
}
const dom_pool = ['FinServ','Healthcare','Retail','HigherEd','Manufacturing','Macro','Other'];

while (catalog.length < 583) {
  const topic = pick(filler_topics);
  const year = ri(2018, 2026);
  const month = ri(1, 12);
  const ext = pickExt();
  const suffix = pick(['', `_v${ri(1,9)}`, `_FINAL`, `_DRAFT`, `_${year}Q${ri(1,4)}`, `_${String(month).padStart(2,'0')}_${year}`, `-${ri(1,12)}`]);
  const name = `${topic}${suffix}.${ext}`;
  if (usedNames.has(name)) continue;
  usedNames.add(name);
  const domain = pick(dom_pool);
  const baseSize = ext === 'mdf' || ext === 'ldf' ? range(100_000, 2_500_000)
    : ext === 'zip' || ext === '7z' || ext === 'gz' ? range(20_000, 500_000)
    : ext === 'pdf' || ext === 'pptx' || ext === 'ppt' ? range(500, 8000)
    : ext === 'xlsx' || ext === 'xls' ? range(200, 12_000)
    : ext === 'csv' ? range(50, 150_000)
    : ext === 'docx' || ext === 'doc' ? range(40, 4000)
    : range(1, 400);
  catalog.push({
    name,
    ext,
    size_kb: Math.round(baseSize),
    domain,
    parsed: ext === 'csv' || ext === 'xlsx' || ext === 'xls' || ext === 'parquet' || ext === 'json' || ext === 'tsv' ? rand() < 0.82 : rand() < 0.35,
    table_name: undefined,
  });
}

// === Write everything ===
mkdirSync(join(HERE, 'institutions'), { recursive: true });

writeFileSync(join(HERE, 'summary.json'), JSON.stringify(summary, null, 2));
writeFileSync(join(HERE, 'institutions.json'), JSON.stringify(institutions, null, 2));
writeFileSync(join(HERE, 'failures.json'), JSON.stringify(failures, null, 2));
writeFileSync(join(HERE, 'state_risk.json'), JSON.stringify(stateRisk, null, 2));
writeFileSync(join(HERE, 'pipeline.json'), JSON.stringify(pipeline, null, 2));
writeFileSync(join(HERE, 'catalog.json'), JSON.stringify(catalog, null, 2));

for (const inst of institutions) {
  writeFileSync(join(HERE, 'institutions', `${inst.cert_id}.json`), JSON.stringify(detailFor(inst), null, 2));
}

console.log(`Generated: ${institutions.length} institutions, ${failures.length} failures, ${stateRisk.length} states, ${catalog.length} catalog entries.`);
