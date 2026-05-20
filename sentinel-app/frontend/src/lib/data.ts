import type { Summary, InstitutionRow, InstitutionDetail, FailureRow, StateRisk, Pipeline, CatalogFile } from '../types';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function load<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export const loadSummary = () => load<Summary>('/data/summary.json');
export const loadInstitutions = () => load<InstitutionRow[]>('/data/institutions.json');
export const loadInstitutionDetail = (certId: string) => load<InstitutionDetail>(`/data/institutions/${certId}.json`);
export const loadFailures = () => load<FailureRow[]>('/data/failures.json');
export const loadStateRisk = () => load<StateRisk[]>('/data/state_risk.json');
export const loadPipeline = () => load<Pipeline>('/data/pipeline.json');
export const loadCatalog = () => load<CatalogFile[]>('/data/catalog.json');
