import type { Conversa } from '@/lib/mock-data';
import type { OfficeCase } from '@/lib/office';

export interface ClientCase {
  pipeline?:number; syncs?: import('./mock-data').Sync[]; id: string; owner: string; responsible: string; mine: boolean; name: string;
  cpf: string; rg: string; phone: string; stage: string; attendance: string;
  petitionNumber: string; work: OfficeCase; processes: Conversa['processos'];
  checklist: Conversa['documentos']; history?: { data: string; evento: string }[]; real?: boolean; email?: string; address?: string; caseTitle?: string;
}
export interface ClientRecord { id: string; name: string; cpf: string; rg: string; phone: string; active: boolean; cases: ClientCase[] }
export function normalizeSearch(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
export function groupClients(cases: ClientCase[]): ClientRecord[] {
  const groups = new Map<string, ClientRecord>();
  for (const c of cases) {
    const cpf = c.cpf.replace(/\D/g, '');
    const key = cpf.length === 11 ? `cpf:${cpf}` : `case:${c.id}`;
    const record = groups.get(key) ?? { id: c.id, name: c.name, cpf: c.cpf, rg: c.rg, phone: c.phone, active: false, cases: [] };
    record.active ||= c.stage === 'ativo';
    record.rg ||= c.rg; record.phone ||= c.phone;
    record.cases.push(c); groups.set(key, record);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
export function matchesClient(client: ClientRecord, query: string) {
  const term = normalizeSearch(query);
  if (!term) return true;
  return client.cases.some(c => [c.name, c.cpf, c.rg, c.phone, c.attendance, c.petitionNumber, c.work.cnj ?? '', c.work.recibo ?? '', ...c.processes.map(p => p.cnj)].some(value => normalizeSearch(value).includes(term)));
}