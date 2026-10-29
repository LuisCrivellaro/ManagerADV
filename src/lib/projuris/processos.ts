// Regras puras sobre processos e andamentos do ProJuris, já normalizados (ver mapeamento.ts).
// Na dúvida, protege: andamento sem "privado = false" explícito é tratado como privado, e processo sem
// "segredoJustica = false" explícito é tratado como segredo de justiça.

export interface EnvolvidoPJ { codigoPessoa: number; cliente: boolean }
export interface ProcessoPJ {
  codigo: number;
  numero?: string;
  orgao?: string;
  vara?: string;
  assunto?: string;
  codigoSituacao?: number;
  situacao?: string;
  segredoJustica: boolean;
  envolvidos: EnvolvidoPJ[];
}
export interface AndamentoPJ { codigo: number; data?: string; hora?: string; tipo?: string; descricao: string; privado: boolean }
export interface AndamentoLegivel { data: string; hora?: string; tipo?: string; descricao: string }

const FUSO = 'America/Sao_Paulo';

/** Processos ativos em que a pessoa aparece como cliente (flagCliente verdadeiro). */
export function processosAtivosDoCliente(processos: ProcessoPJ[], codigoPessoa: number, codigoSituacaoAtivo: number): ProcessoPJ[] {
  return processos.filter(p => p.codigoSituacao === codigoSituacaoAtivo && p.envolvidos.some(e => e.codigoPessoa === codigoPessoa && e.cliente));
}

/** Segredo de justiça não é detalhado ao cliente: a equipe entra em contato. */
export function podeDetalhar(p: ProcessoPJ): boolean {
  return !p.segredoJustica;
}

/** Ordenação no horário de Brasília: "AAAA-MM-DDTHH:MM". */
function chaveOrdem(data?: string, hora?: string): string {
  const dia = diaBrasilia(data) ?? '0000-00-00';
  const h = /^(\d{1,2}):(\d{2})/.exec(hora ?? '');
  const horario = h ? `${h[1]!.padStart(2, '0')}:${h[2]}` : horaBrasilia(data) ?? '00:00';
  return `${dia}T${horario}`;
}

function partes(valor: string | number): Record<string, string> | undefined {
  const t = typeof valor === 'number' ? valor : Date.parse(valor);
  if (!Number.isFinite(t)) return undefined;
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]));
}

/** Dia "AAAA-MM-DD" em Brasília. Data pura (sem hora) é dia de calendário, sem conversão de fuso. */
function diaBrasilia(valor?: string | number): string | undefined {
  if (valor === undefined || valor === '') return undefined;
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const p = partes(/^\d+$/.test(String(valor)) ? Number(valor) : valor);
  return p ? `${p['year']}-${p['month']}-${p['day']}` : undefined;
}

function horaBrasilia(valor?: string | number): string | undefined {
  if (valor === undefined || valor === '' || (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor))) return undefined;
  const p = partes(/^\d+$/.test(String(valor)) ? Number(valor) : valor);
  return p ? `${p['hour']}:${p['minute']}` : undefined;
}

/** "20/10/2026" no horário de Brasília. */
export function dataLegivel(valor?: string | number): string | undefined {
  const d = diaBrasilia(valor);
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : undefined;
}

/** "14h30" a partir de "14:30:00". */
export function horaLegivel(hora?: string): string | undefined {
  const h = /^(\d{1,2}):(\d{2})/.exec(hora ?? '');
  return h ? `${Number(h[1])}h${h[2] === '00' ? '' : h[2]}` : undefined;
}

/** As n últimas movimentações não privadas, da mais recente para a mais antiga, com data legível. */
export function ultimosAndamentosPublicos(andamentos: AndamentoPJ[], n = 3): AndamentoLegivel[] {
  return andamentos
    .filter(a => !a.privado && a.descricao.trim() && dataLegivel(a.data))
    .sort((a, b) => chaveOrdem(b.data, b.hora).localeCompare(chaveOrdem(a.data, a.hora)))
    .slice(0, n)
    .map(a => {
      const hora = horaLegivel(a.hora);
      return { data: dataLegivel(a.data)!, ...(hora ? { hora } : {}), ...(a.tipo ? { tipo: a.tipo } : {}), descricao: a.descricao.trim() };
    });
}

/** Identificação do processo para o pedido de aprovação: número, órgão/vara e assunto. */
export function identificacaoProcesso(p: ProcessoPJ): string {
  const local = [p.orgao, p.vara].filter(Boolean).join(' / ');
  return [p.numero ? `nº ${p.numero}` : `código ${p.codigo}`, local, p.assunto].filter(Boolean).join(' · ');
}
