// Regras puras do agendamento real (Google Calendar). Sem rede: testável e usado pelo servidor.
// Brasília sem horário de verão desde 2019: deslocamento fixo -03:00.
import { chosenSlot, formatarHorarioCliente, normalized } from './base';

export interface ConfigAgenda {
  duracaoMin: number;
  primeiroInicio: string; // HH:MM
  ultimoInicio: string; // HH:MM
  passoMin: number;
  antecedenciaMinHoras: number;
  diasUteisJanela: number;
  opcoes: number;
}

/** Valores provisórios combinados em 22/10/2026: consulta online de 30 min, seg a sex, 8h às 18h. */
export const CONFIG_AGENDA: ConfigAgenda = {
  duracaoMin: 30,
  primeiroInicio: '08:00',
  ultimoInicio: '17:30',
  passoMin: 30,
  antecedenciaMinHoras: 2,
  diasUteisJanela: 10,
  opcoes: 3,
};

export interface Ocupado { start: string; end: string }
export interface ConsultaAgendada { inicio: string; eventoId: string; meetLink: string }

function dataSP(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d).map(x => [x.type, x.value]));
  return `${p['year']}-${p['month']}-${p['day']}`;
}
function minutos(hhmm: string) { const [h, m] = hhmm.split(':').map(Number); return (h ?? 0) * 60 + (m ?? 0); }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`; }

/** Inícios possíveis nos próximos dias úteis, já respeitando a antecedência mínima. */
export function gerarCandidatos(now = new Date(), cfg = CONFIG_AGENDA): string[] {
  const limite = now.getTime() + cfg.antecedenciaMinHoras * 3600_000;
  const dia = new Date(`${dataSP(now)}T12:00:00Z`);
  const out: string[] = [];
  let uteis = 0;
  for (let i = 0; i < 40 && uteis < cfg.diasUteisJanela; i++) {
    if (i > 0) dia.setUTCDate(dia.getUTCDate() + 1);
    if ([0, 6].includes(dia.getUTCDay())) continue;
    uteis++;
    const data = dia.toISOString().slice(0, 10);
    for (let m = minutos(cfg.primeiroInicio); m <= minutos(cfg.ultimoInicio); m += cfg.passoMin) {
      const iso = new Date(`${data}T${hhmm(m)}:00-03:00`).toISOString();
      if (Date.parse(iso) >= limite) out.push(iso);
    }
  }
  return out;
}

/** Remove inícios cuja consulta encostaria em qualquer período ocupado da agenda. */
export function removerOcupados(candidatos: string[], ocupados: Ocupado[], duracaoMin = CONFIG_AGENDA.duracaoMin) {
  const busy = ocupados.map(o => [Date.parse(o.start), Date.parse(o.end)] as const);
  return candidatos.filter(iso => {
    const s = Date.parse(iso), e = s + duracaoMin * 60_000;
    return !busy.some(([bs, be]) => s < be && e > bs);
  });
}

function partes(iso: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return { dia: dataSP(new Date(iso)), semana: normalized(p['weekday'] ?? ''), dd: Number(p['day']), mm: Number(p['month']), hora: Number(p['hour']) };
}
const SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

/** Aplica preferências ditas pelo cliente: dia da semana, data (dd/mm), manhã ou tarde. */
export function filtrarPorPreferencia(livres: string[], texto: string) {
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const semanas = SEMANA.filter(s => new RegExp(`\\b${s}(?:-feira)?\\b(?!\\s+op)`).test(t));
  const datas = [...t.matchAll(/\b(\d{1,2})\/(\d{1,2})\b/g)].map(m => ({ dd: Number(m[1]), mm: Number(m[2]) }));
  const manha = /\bmanha\b/.test(t), tarde = /\btarde\b/.test(t);
  const temPreferencia = semanas.length > 0 || datas.length > 0 || manha !== tarde;
  const filtrados = livres.filter(iso => {
    const p = partes(iso);
    if (semanas.length && !semanas.some(s => p.semana.startsWith(s))) return false;
    if (datas.length && !datas.some(d => d.dd === p.dd && d.mm === p.mm)) return false;
    if (manha && !tarde && p.hora >= 12) return false;
    if (tarde && !manha && p.hora < 13) return false;
    return true;
  });
  return { temPreferencia, filtrados };
}

/** Escolhe poucas opções espalhadas: o primeiro horário de cada dia, depois os seguintes (até maxDias dias). */
export function escolherOpcoes(livres: string[], qtd = CONFIG_AGENDA.opcoes, excluir: string[] = [], maxDias = Infinity) {
  const porDia = new Map<string, string[]>();
  for (const iso of livres.filter(x => !excluir.includes(x))) {
    const d = partes(iso).dia;
    porDia.set(d, [...(porDia.get(d) ?? []), iso]);
  }
  const dias = [...porDia.values()].slice(0, maxDias);
  const out: string[] = [];
  for (let rodada = 0; out.length < qtd && dias.some(d => d.length > rodada); rodada++)
    for (const d of dias) { const s = d[rodada]; if (s && out.length < qtd) out.push(s); }
  return out.sort();
}

/** Reconhece a escolha do cliente entre os horários oferecidos (data/hora, ordem ou dia único). */
export function escolhaDoCliente(oferecidos: string[], texto: string): string | undefined {
  if (!oferecidos.length) return undefined;
  const direto = chosenSlot(oferecidos, texto);
  if (direto) return direto;
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const ordem = /\b(?:a |o )?primeir[ao]\b|\bopcao 1\b|^1$/.test(t) ? 0
    : /\bsegund[ao] (?:opcao|horario)\b|\bopcao 2\b|^2$/.test(t) ? 1
    : /\bterceir[ao]\b|\bopcao 3\b|^3$/.test(t) ? 2
    : /\bultim[ao]\b/.test(t) ? oferecidos.length - 1 : -1;
  if (ordem >= 0) return oferecidos[ordem];
  if (/\d{1,2}(?:h|:\d{2})/.test(t)) return undefined; // hora citada que não bate: não adivinhar
  const { temPreferencia, filtrados } = filtrarPorPreferencia(oferecidos, texto);
  return temPreferencia && filtrados.length === 1 ? filtrados[0] : undefined;
}

export function pedeOutrasOpcoes(texto: string) {
  return /\b(?:outr[ao]s?|nenhum|nao (?:posso|consigo|da)|nao serve|mais tarde|mais cedo)\b/.test(texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}

export function emailValido(email: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()); }
/** Dados mínimos para reservar: nome e e-mail (destino do convite do Meet). */
export function dadosFaltantes(d: { nome?: string; email?: string } | undefined) {
  const f: ('nome' | 'email')[] = [];
  if (!d?.nome?.trim()) f.push('nome');
  if (!d?.email || !emailValido(d.email)) f.push('email');
  return f;
}
export function perguntaDado(campo: 'nome' | 'email') {
  return campo === 'nome'
    ? 'Para marcar a consulta, qual é o seu nome completo?'
    : 'Qual e-mail você usa? É para lá que vai o convite com o link da consulta.';
}
/** A IA nunca oferece horário: qualquer hora no texto dela é descartada pelo servidor. */
export function textoComHorario(texto: string) { return /\b\d{1,2}(?:h\d{0,2}|:\d{2})\b/.test(texto); }
/** Hora de consulta citada no texto, ignorando frases de expediente ("a partir das 8h", "das 8h às 18h"). */
export function citaHorarioDeConsulta(texto: string) {
  return textoComHorario(texto
    .replace(/\b(?:das\s+)?\d{1,2}h\s*(?:às|as|a|até|ate)\s*\d{1,2}h\b/gi, '')
    .replace(/\ba partir das\s+\d{1,2}h\d{0,2}\b/gi, '')
    .replace(/\b(?:até|ate) (?:as|às)\s+\d{1,2}h\d{0,2}\b/gi, ''));
}

/** Dia da semana com inicial minúscula no meio da frase. */
const noMeio = (iso: string) => { const t = formatarHorarioCliente(iso); return t.charAt(0).toLowerCase() + t.slice(1); };
const lista = (slots: string[]) => slots.map(s => `• ${formatarHorarioCliente(s)}`).join('\n');
export const mensagensAgenda = {
  opcoes: (slots: string[], semNoPeriodo = false) =>
    `${semNoPeriodo ? 'Não tenho horário livre nesse período. As próximas opções são:' : `Tenho estes horários para a consulta online de ${CONFIG_AGENDA.duracaoMin} minutos, pelo Google Meet:`}\n${lista(slots)}\nQual fica melhor para você?`,
  ocupado: (slots: string[]) => `Esse horário acabou de ser preenchido. Tenho estas outras opções:\n${lista(slots)}\nQual fica melhor para você?`,
  confirmada: (inicio: string, link: string) =>
    `Pronto! Sua consulta está marcada para ${noMeio(inicio)}, pelo Google Meet (${CONFIG_AGENDA.duracaoMin} minutos).\nLink: ${link}\nO convite também vai chegar no seu e-mail.`,
  jaMarcada: (inicio: string, link: string) =>
    `Sua consulta já está marcada para ${noMeio(inicio)}. Link: ${link}\nSe precisar remarcar ou cancelar, deixei o pedido registrado para a equipe.`,
  semHorarios: 'No momento não encontrei horários livres nos próximos dias. Deixei seu pedido registrado e a equipe vai te chamar para marcar.',
  erro: 'Não consegui acessar a agenda agora. Deixei seu pedido registrado e a equipe vai te chamar para marcar.',
};

/* ---------- Rótulos naturais e horários de um dia (fluxo conversacional) ---------- */
// Todos aceitam um fuso (IANA). Padrão: Brasília. Clientes no exterior veem o horário local e o de Brasília.
export const FUSO_BRASILIA = 'America/Sao_Paulo';
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export function fusoValido(tz: string) { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; } }
const dataEm = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function infoDia(iso: string, tz = FUSO_BRASILIA) {
  const dia = dataEm(new Date(iso), tz);
  const dow = new Date(`${dia}T12:00:00Z`).getUTCDay();
  return { dia, dow, ddmm: `${dia.slice(8, 10)}/${dia.slice(5, 7)}` };
}
function somarDias(dia: string, n: number) { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
/** "8h", "8h30". */
export function horaCurta(iso: string, tz = FUSO_BRASILIA) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map(x => [x.type, x.value]));
  return `${Number(p['hour'])}h${p['minute'] === '00' ? '' : p['minute']}`;
}
/** "hoje (qui, 22/10)", "amanhã (sex, 23/10)" ou "seg, 26/10" — no fuso indicado. */
export function rotuloDia(iso: string, now = new Date(), tz = FUSO_BRASILIA) {
  const { dia, dow, ddmm } = infoDia(iso, tz);
  const hoje = dataEm(now, tz);
  if (dia === hoje) return `hoje (${SEMANA_CURTA[dow]}, ${ddmm})`;
  if (dia === somarDias(hoje, 1)) return `amanhã (${SEMANA_CURTA[dow]}, ${ddmm})`;
  return `${SEMANA_CURTA[dow]}, ${ddmm}`;
}
const fusoExterior = (tz: string) => tz !== FUSO_BRASILIA;
/** "hoje (qui, 22/10) às 14h30" ou "seg, 26/10, às 12h no seu horário (8h em Brasília)". */
export function rotuloRelativo(iso: string, now = new Date(), tz = FUSO_BRASILIA) {
  const r = rotuloDia(iso, now, tz);
  return `${r}${r.includes('(') ? '' : ','} às ${horaCurta(iso, tz)}${fusoExterior(tz) ? ` no seu horário (${horaCurta(iso)} em Brasília)` : ''}`;
}
/** "sexta-feira, 23/10, às 8h" — para a confirmação final. */
export function rotuloCompleto(iso: string, tz = FUSO_BRASILIA) {
  const { dow, ddmm } = infoDia(iso, tz);
  return `${SEMANA_LONGA[dow]}, ${ddmm}, às ${horaCurta(iso, tz)}${fusoExterior(tz) ? ` no seu horário (${horaCurta(iso)} em Brasília)` : ''}`;
}
function juntarHoras(h: string[]) { return h.length <= 1 ? h.join('') : `${h.slice(0, -1).join(', ')} ou ${h.at(-1)}`; }
/** Agrupa por dia do cliente: "amanhã (sex, 23/10) às 8h ou 8h30". */
export function linhasOpcoes(slots: string[], now = new Date(), tz = FUSO_BRASILIA) {
  const porDia = new Map<string, string[]>();
  for (const s of [...slots].sort()) { const d = infoDia(s, tz).dia; porDia.set(d, [...(porDia.get(d) ?? []), s]); }
  return [...porDia.values()].map(g => {
    const r = rotuloDia(g[0]!, now, tz);
    const local = `${r}${r.includes('(') ? '' : ','} às ${juntarHoras(g.map(s => horaCurta(s, tz)))}`;
    return fusoExterior(tz) ? `${local} no seu horário (${juntarHoras(g.map(s => horaCurta(s)))} em Brasília)` : local;
  });
}
/** Data pedida pelo cliente ("sexta", "amanhã", "30/10") → horários livres do dia mais próximo com vaga, até 4. */
export function horariosDoDia(livres: string[], pedido: string, now = new Date(), max = 4) {
  const t = pedido.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const hoje = dataSP(now);
  let datas = [...new Set(livres.map(l => infoDia(l).dia))];
  if (/\bhoje\b/.test(t)) datas = datas.filter(d => d === hoje);
  else if (/\bamanha\b/.test(t)) datas = datas.filter(d => d === somarDias(hoje, 1));
  else {
    const { temPreferencia, filtrados } = filtrarPorPreferencia(livres, pedido.replace(/manh[ãa]|tarde/gi, ''));
    if (!temPreferencia) return undefined;
    datas = [...new Set(filtrados.map(l => infoDia(l).dia))];
  }
  const dia = datas.sort()[0];
  if (!dia) return { dia: '', slots: [] as string[] };
  let slots = livres.filter(l => infoDia(l).dia === dia);
  if (/manha/.test(t) && !/tarde/.test(t)) slots = slots.filter(s => Number(horaCurta(s).split('h')[0]) < 12);
  if (/tarde/.test(t) && !/manha/.test(t)) slots = slots.filter(s => Number(horaCurta(s).split('h')[0]) >= 13);
  if (slots.length > max) { // espalha pelo dia: manhã e tarde
    const m = slots.filter(s => Number(horaCurta(s).split('h')[0]) < 12), tt = slots.filter(s => Number(horaCurta(s).split('h')[0]) >= 12);
    const metade = Math.ceil(max / 2);
    slots = [...m.slice(0, tt.length ? metade : max), ...tt.slice(0, m.length ? max - Math.min(metade, m.length) : max)].slice(0, max).sort();
  }
  return { dia, slots };
}
/** Nome e sobrenome, só letras. */
export function nomeCompletoValido(nome: string) {
  const n = nome.trim();
  return /^[\p{L}][\p{L}'.\- ]+$/u.test(n) && n.split(/\s+/).filter(p => p.length > 1).length >= 2;
}
/** Próximo dia útil a partir de amanhã: "segunda-feira, 26/10". */
export function proximoDiaUtil(now = new Date()) {
  let d = somarDias(dataSP(now), 1);
  while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = somarDias(d, 1);
  const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
  return `${SEMANA_LONGA[dow]}, ${d.slice(8, 10)}/${d.slice(5, 7)}`;
}
/** Documentos úteis para a consulta, conforme o assunto. */
export function documentosSugeridos(assunto: string) {
  const t = assunto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/demit|demiss|rescis|verbas|trabalh|carteira|fgts|salario|hora extra|empresa|patrao|acidente de trabalho/.test(t))
    return 'carteira de trabalho, termo de rescisão (se recebeu), últimos holerites e extrato do FGTS';
  if (/aluguel|despejo|contrato|imovel|locacao/.test(t)) return 'o contrato, comprovantes de pagamento e as conversas sobre o assunto';
  if (/consumidor|compra|banco|cobranc|divida|plano de saude|cartao/.test(t)) return 'contratos, faturas ou comprovantes e prints das conversas com a empresa';
  return 'documentos, comprovantes e conversas relacionados ao assunto';
}
