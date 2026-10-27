import type { Conversa, Processo } from './mock-data';
import type { OfficeCase } from './office';

// Saved records only: pipeline sync markers are not evidence of a ProJuris import.
export function attendanceProcesses(c: Conversa, work: OfficeCase) {
  const processes = new Map<string, Partial<Processo> & { cnj: string }>();
  for (const p of c.processos) if (p.cnj.trim()) processes.set(p.cnj.trim(), { ...p, cnj: p.cnj.trim() });
  const cnj = work.cnj?.trim();
  if (cnj && !processes.has(cnj)) processes.set(cnj, { cnj, ...(work.vara ? { vara: work.vara } : {}) });
  for (const m of work.movements ?? []) {
    const number = m.cnj.trim();
    if (number && !processes.has(number)) processes.set(number, { cnj: number });
  }
  return [...processes.values()].map(p => ({
    ...p,
    movements: (work.movements ?? []).filter(m => m.cnj.trim() === p.cnj).slice().sort((a, b) => b.data.localeCompare(a.data)),
  }));
}

export function savedDate(value?: string) {
  if (!value) return 'Não informado';
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('pt-BR') : value;
}