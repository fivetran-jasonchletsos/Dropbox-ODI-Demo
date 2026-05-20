export type RiskTier = 'low' | 'watch' | 'elevated' | 'high';
export type CharterClass = 'N' | 'NM' | 'SM' | 'SB' | 'SA';
export type AssetClass = '<100M' | '100M-1B' | '1B-10B' | '10B-100B' | '>100B';
export type LayerName = 'bronze' | 'silver' | 'gold';
export type StatusLevel = 'ok' | 'warn' | 'error';
export type EventLevel = 'info' | 'warn' | 'error';

export interface InstitutionRow {
  cert_id: string;
  name: string;
  city: string;
  state: string;
  charter_class: CharterClass;
  asset_class: AssetClass;
  deposits_b: number;
  branches: number;
  established_year: number;
  risk_score: number;
  risk_tier: RiskTier;
  capital_ratio_pct: number;
  net_charge_off_ratio_pct: number;
  return_on_assets_pct: number;
}

export interface InstitutionDetail extends InstitutionRow {
  branches_by_state: { state: string; count: number; deposits_b: number }[];
  peer_failures: { name: string; close_date: string; charter_class: string; reason: string }[];
  quarterly: { q: string; deposits_b: number; npl_ratio: number; capital_ratio: number }[];
  ai_summary: string;
}

export interface FailureRow {
  cert_id: string;
  name: string;
  city: string;
  state: string;
  close_date: string;
  fund: string;
  acquirer: string;
  charter_class: string;
}

export interface StateRisk {
  state: string;
  state_name: string;
  total_deposits_b: number;
  total_branches: number;
  total_institutions: number;
  failed_count_5y: number;
  failure_rate_pct_5y: number;
  risk_index: number;
}

export interface Summary {
  total_institutions: number;
  total_deposits_b: number;
  total_branches: number;
  total_failed_banks_since_2008: number;
  failure_rate_pct_5y: number;
  top_states_by_deposits: { state: string; deposits_b: number }[];
  file_inventory: {
    total_files: number;
    total_bytes: number;
    by_ext: { ext: string; count: number }[];
    by_domain: { domain: string; count: number }[];
  };
  pipeline_status: {
    layer: LayerName;
    table_count: number;
    row_count: number;
    last_built_at: string;
  }[];
  last_synced_at: string;
  national_failure_trend: { year: number; count: number }[];
}

export interface PipelineTable {
  name: string;
  rows: number;
  updated_at: string;
  depends_on?: string[];
}

export interface Pipeline {
  source: { connector: 'dropbox' | 'fdic_api'; folder: string; file_count: number; last_run: string };
  layers: {
    bronze: { tables: PipelineTable[]; status: StatusLevel };
    silver: { tables: PipelineTable[]; status: StatusLevel };
    gold: { tables: PipelineTable[]; status: StatusLevel };
  };
  recent_events: { ts: string; level: EventLevel; msg: string }[];
}

export interface CatalogFile {
  name: string;
  ext: string;
  size_kb: number;
  domain: string;
  parsed: boolean;
  table_name?: string;
}
