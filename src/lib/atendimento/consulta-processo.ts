// Consulta de processo pela Ana na fase de testes: nenhuma informação de processo vai ao cliente sem aprovação
// da revisora. Módulo único para o servidor (ProJuris real) e para o simulador (ProJuris fictício): a lógica é a
// mesma e só mudam as portas (consulta, redação, envio, registro, relógio). Regras de prazo: REGRAS-DA-DOUTORA.md.
import { feriadoNacional } from './schedule-rules';
import { cpfNoTexto, pessoaPorCpf, TEXTOS_VINCULO, vinculoPendentePorCpf, vinculoPorTelefone, type PessoaCpf, type VinculoProjuris } from '../projuris/vinculo';
import { podeDetalhar, identificacaoProcesso, type AndamentoLegivel, type ProcessoPJ } from '../projuris/processos';
import type { Identificacao } from '../projuris/identificacao';
import { mesmoTelefone } from '../projuris/telefone';

export interface ConfigConsultaProcesso {
  /** Ligada na fase de testes; só a Dra. desliga. */
  aprovacao_processo: boolean;
  /** Dado extra de confirmação antes de mostrar processos; preparada e desligada nesta fase. */
  verificacao_processo: boolean;
  lembreteMin: number;
  maxLembretes: number;
  avisoRetornoMin: number;
}
export const CONFIG_CONSULTA_PADRAO: ConfigConsultaProcesso = { aprovacao_processo: true, verificacao_processo: false, lembreteMin: 30, maxLembretes: 3, avisoRetornoMin: 60 };

export interface FatoProcesso { codigo: number; identificacao: string; numero?: string; assunto?: string; segredo: boolean; andamentos: AndamentoLegivel[] }
export type StatusPedido = 'pendente' | 'aprovado' | 'corrigido' | 'recusado';
export interface PedidoProcesso {
  codigo: string;
  conversaId: string;
  contato: { nome: string; telefone: string };
  identificadoPor: string;
  processos: FatoProcesso[];
  textoProposto: string;
  hash: string;
  rascunhoPadrao: boolean;
  status: StatusPedido;
  criadoEm: string;
  lembretesEm: string[];
  avisoRetornoEm?: string;
  decisao?: { por: string; canal: 'revisora' | 'manager'; em: string; textoEnviado?: string; hashEnviado?: string };
}

const FUSO = 'America/Sao_Paulo';
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// ---------- Prazos (REGRAS: passagem até 17h em dia útil pode ter resposta hoje; senão, próximo dia útil a partir das 8h) ----------
function partesBrasilia(agora: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(agora).map(x => [x.type, x.value]));
  return { data: `${p['year']}-${p['month']}-${p['day']}`, dia: p['weekday'] ?? '', hora: Number(p['hour']) };
}
export function diaUtil(agora: Date): boolean {
  const { data, dia } = partesBrasilia(agora);
  return dia !== 'Sat' && dia !== 'Sun' && !feriadoNacional(data);
}
export function prazoRetorno(agora: Date): 'hoje' | 'proximo_dia_util' {
  return diaUtil(agora) && partesBrasilia(agora).hora < 17 ? 'hoje' : 'proximo_dia_util';
}
/** Mesma redação da passagem atual para a equipe. */
export function frasePrazo(agora: Date): string {
  return prazoRetorno(agora) === 'hoje' ? 'Alguém responsável te responde por aqui ainda hoje.' : 'Alguém responsável te responde no próximo dia útil, a partir das 8h.';
}

// ---------- Textos fixos ao cliente (nenhum traz dado de processo) ----------
export const TEXTOS_CONSULTA = {
  aviso: 'Vou consultar as informações do seu processo e te retorno em seguida.',
  perguntaAssunto: 'Para eu consultar certinho: sobre qual assunto você quer notícias?',
  emConferencia: 'Sua consulta está em conferência com a equipe. Assim que estiver pronta, eu te retorno por aqui.',
  equipe: (agora: Date) => `Vou deixar com a equipe, que te retorna com as informações. ${frasePrazo(agora)}`,
  avisoRetorno: (agora: Date) => `A conferência das informações está levando um pouco mais de tempo. ${frasePrazo(agora)}`,
};

// ---------- Escolha do processo pelo assunto, sem listar processos antes da aprovação ----------
const GRUPOS: { cliente: RegExp; processo: RegExp; justica?: string }[] = [
  { cliente: /trabalh|clt|reclamat|rescis|fgts|empreg|demiss|patrao|carteira assinada|hora extra/, processo: /trabalh|trt|reclamat/, justica: '5' },
  { cliente: /pensao|aliment/, processo: /aliment|pensao/ },
  { cliente: /divorc|separac/, processo: /divorc|separac|dissoluc/ },
  { cliente: /guarda|visita|convivencia/, processo: /guarda|visita|convivencia|regulamentac/ },
  { cliente: /inventari|heranca|partilha/, processo: /inventari|heranca|partilha|arrolamento/ },
  { cliente: /indeniz|danos? mora|consumidor|banco/, processo: /indeniz|danos?|consumidor|banc/ },
];
const naoSabe = (t: string) => /\b(?:nao sei|todos|todas|os dois|as duas|os tres|qualquer|tanto faz|geral)\b/.test(t);

/** Justiça do número CNJ (NNNNNNN-DD.AAAA.J.TR.OOOO): 5 = Trabalho, 8 = Estadual, 4 = Federal. */
function justicaCnj(numero?: string) { return /\d{7}-\d{2}\.\d{4}\.(\d)\.\d{2}\.\d{4}/.exec(numero ?? '')?.[1]; }

export function escolherProcessos(processos: ProcessoPJ[], textoCliente: string): { escolhidos: ProcessoPJ[]; criterio: 'unico' | 'assunto' | 'todos' | 'indefinido' } {
  if (processos.length <= 1) return { escolhidos: processos, criterio: 'unico' };
  const t = fold(textoCliente);
  if (naoSabe(t)) return { escolhidos: processos, criterio: 'todos' };
  const texto = (p: ProcessoPJ) => fold([p.assunto, p.orgao, p.vara].filter(Boolean).join(' '));
  for (const g of GRUPOS) {
    if (!g.cliente.test(t)) continue;
    const achados = processos.filter(p => g.processo.test(texto(p)) || (g.justica !== undefined && justicaCnj(p.numero) === g.justica));
    if (achados.length) return { escolhidos: achados, criterio: 'assunto' };
  }
  const palavras = new Set(t.split(/[^a-z]+/).filter(w => w.length >= 5));
  const porPalavra = processos.filter(p => texto(p).split(/[^a-z]+/).some(w => palavras.has(w)));
  return porPalavra.length ? { escolhidos: porPalavra, criterio: 'assunto' } : { escolhidos: processos, criterio: 'indefinido' };
}

// ---------- Fatos, validação do rascunho e rascunho padrão ----------
export function fatoDe(p: ProcessoPJ, andamentos: AndamentoLegivel[]): FatoProcesso {
  if (!podeDetalhar(p)) return { codigo: p.codigo, identificacao: `código ${p.codigo} (segredo de justiça)`, segredo: true, andamentos: [] };
  return { codigo: p.codigo, identificacao: identificacaoProcesso(p), ...(p.numero ? { numero: p.numero } : {}), ...(p.assunto ? { assunto: p.assunto } : {}), segredo: false, andamentos };
}

/** O que vai para a redação: processo em segredo segue sem número, assunto ou andamentos. */
export function fatosParaRedacao(nome: string, fatos: FatoProcesso[]) {
  return {
    primeiro_nome: nome.trim().split(/\s+/)[0] ?? '',
    processos: fatos.map(f => f.segredo ? { segredo_de_justica: true } : { numero: f.numero ?? '', assunto: f.assunto ?? '', movimentacoes: f.andamentos.map(a => ({ data: a.data, ...(a.hora ? { hora: a.hora } : {}), ...(a.tipo ? { tipo: a.tipo } : {}), descricao: a.descricao, ...(a.simplificacao ? { simplificacao_projuris: a.simplificacao } : {}) })) }),
  };
}

const CNJ = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
const DATA = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;

/** O rascunho só pode trazer números de processo e datas presentes nos fatos detalháveis. */
export function validarRascunho(texto: string, fatos: FatoProcesso[]): { ok: boolean; problemas: string[] } {
  const problemas: string[] = [];
  if (!texto.trim()) problemas.push('rascunho vazio');
  const numeros = new Set(fatos.filter(f => !f.segredo).map(f => f.numero).filter(Boolean));
  for (const n of texto.match(CNJ) ?? []) if (!numeros.has(n)) problemas.push(`número de processo fora dos fatos: ${n}`);
  const completa = (d: string, m: string, a: string) => `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${a.length === 2 ? `20${a}` : a}`;
  const datas = new Set(fatos.flatMap(f => f.andamentos.flatMap(a => [a.data, ...[...a.descricao.matchAll(DATA)].filter(x => x[3]).map(x => completa(x[1]!, x[2]!, x[3]!))])));
  const diasMeses = new Set([...datas].map(d => d.slice(0, 5)));
  for (const m of texto.matchAll(DATA)) {
    const dia = m[1]!.padStart(2, '0'), mes = m[2]!.padStart(2, '0');
    if (m[3] ? !datas.has(completa(dia, mes, m[3])) : !diasMeses.has(`${dia}/${mes}`)) problemas.push(`data fora dos fatos: ${m[0]}`);
  }
  if (/^\s*\d+[.)]\s/m.test(texto)) problemas.push('lista numerada');
  return { ok: problemas.length === 0, problemas };
}

export const SAUDACAO_ANDAMENTO = (nome: string) => `Olá, ${nome}! 😊\n\nConsultei seu processo em nosso sistema e trouxe uma atualização para você.`;
export const FECHAMENTO_ANDAMENTO = 'Nossa equipe continua acompanhando seu processo e, caso haja alguma novidade ou providência necessária, entraremos em contato.\n\nSe tiver alguma dúvida, estou à disposição para ajudar!\n\nAtenciosamente,\nEquipe CS Advocacia\nwww.carolinasantos.com.br';
export const SEM_MOVIMENTACAO = 'Ainda não há movimentação registrada.';
export const AVISO_SEGREDO = 'Sobre um dos seus processos, nossa equipe vai entrar em contato com você.';
/** Explicação neutra do rascunho padrão quando o ProJuris não traz simplificação; a revisora confere. */
export const EXPLICACAO_PADRAO = 'Esta é a movimentação mais recente registrada no seu processo. Se quiser, nossa equipe explica com mais detalhes.';

/** Rascunho determinístico no modelo oficial de andamento; usado quando a redação falha ou não passa na validação. */
export function rascunhoPadrao(nome: string, fatos: FatoProcesso[]): string {
  const primeiro = nome.trim().split(/\s+/)[0] || 'cliente';
  const varios = fatos.length > 1;
  const blocos = fatos.map(f => {
    if (f.segredo) return AVISO_SEGREDO;
    const titulo = `📄 Andamento do processo${varios && f.assunto ? ` (${f.assunto})` : ''}:`;
    const a = f.andamentos[0];
    if (!a) return `${titulo}\n${SEM_MOVIMENTACAO}`;
    return `${titulo}\n${a.descricao}\n\n📅 Última movimentação:\n${a.data}\n\nO que isso significa?\n${a.simplificacao ?? EXPLICACAO_PADRAO}`;
  });
  return `${SAUDACAO_ANDAMENTO(primeiro)}\n\n${blocos.join('\n\n')}\n\n${FECHAMENTO_ANDAMENTO}`;
}

// ---------- Pedido de aprovação ----------
export function proximoCodigo(existentes: string[]): string {
  const maior = existentes.map(c => Number(/^AND-(\d+)$/.exec(c)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0);
  return `AND-${String(maior + 1).padStart(4, '0')}`;
}

export async function hashTexto(texto: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Mensagem à revisora: código, contato, identificação, processos, andamentos originais e texto proposto. */
export function mensagemRevisora(p: PedidoProcesso): string {
  const processos = p.processos.map(f => f.segredo
    ? `• ${f.identificacao}: não detalhado ao cliente.`
    : `• ${f.identificacao}\n${f.andamentos.length ? f.andamentos.map(a => `   - ${a.data}${a.hora ? ` ${a.hora}` : ''} · ${a.tipo ?? 'sem tipo'} · ${a.descricao}`).join('\n') : '   - sem movimentação registrada'}`).join('\n');
  return [
    `Pedido ${p.codigo}: notícia de processo para aprovar`,
    `Contato: ${p.contato.nome} · ${p.contato.telefone}`,
    `Identificação: ${p.identificadoPor}`,
    `Processo(s) e andamentos do ProJuris:\n${processos}`,
    `Texto proposto ao cliente${p.rascunhoPadrao ? ' (rascunho padrão)' : ''}:\n"""\n${p.textoProposto}\n"""`,
    `Responda "ok ${p.codigo}" para enviar este texto, "corrigir ${p.codigo}: seu texto" para enviar o seu, ou "não ${p.codigo}" para recusar.`,
  ].join('\n\n');
}

// ---------- Resposta da revisora ----------
export type ComandoRevisora =
  | { acao: 'aprovar'; codigo: string }
  | { acao: 'corrigir'; codigo: string; texto: string }
  | { acao: 'recusar'; codigo: string }
  | { acao: 'ambiguo'; motivo: string }
  | { acao: 'desconhecido' };

export function interpretarRespostaRevisora(texto: string, pendentes: string[]): ComandoRevisora {
  const bruto = texto.trim();
  const t = fold(bruto);
  const codigo = /\band-(\d{1,6})\b/.exec(t)?.[1];
  const alvo = codigo ? `AND-${codigo.padStart(4, '0')}` : undefined;
  const escolher = (): { codigo: string } | { motivo: string } => {
    if (alvo) return pendentes.includes(alvo) ? { codigo: alvo } : { motivo: `${alvo} não está pendente.` };
    if (pendentes.length === 1) return { codigo: pendentes[0]! };
    return { motivo: pendentes.length ? `Há ${pendentes.length} pedidos pendentes: informe o código (${pendentes.join(', ')}).` : 'Não há pedido pendente.' };
  };
  const corrigir = /^corrigir\b[^:]*:\s*([\s\S]+)$/i.exec(bruto);
  if (corrigir) {
    const e = escolher();
    const novo = corrigir[1]!.trim();
    if ('motivo' in e) return { acao: 'ambiguo', motivo: e.motivo };
    return novo ? { acao: 'corrigir', codigo: e.codigo, texto: novo } : { acao: 'ambiguo', motivo: 'Correção sem texto.' };
  }
  if (/^corrigir\b/.test(t)) return { acao: 'ambiguo', motivo: 'Use "corrigir CÓDIGO: texto".' };
  if (/^(?:ok|aprovad[oa]|aprovo|pode enviar)\b(?:\s+and-\d+)?[\s.!]*$/.test(t)) {
    const e = escolher();
    return 'motivo' in e ? { acao: 'ambiguo', motivo: e.motivo } : { acao: 'aprovar', codigo: e.codigo };
  }
  if (/^(?:nao|recusar|recuso|recusado)\b(?:\s+and-\d+)?[\s.!]*$/.test(t)) {
    const e = escolher();
    return 'motivo' in e ? { acao: 'ambiguo', motivo: e.motivo } : { acao: 'recusar', codigo: e.codigo };
  }
  return { acao: 'desconhecido' };
}

export interface DecisaoAplicada { pedido: PedidoProcesso; enviarCliente?: string; pausarAna: boolean }

/** Aplica a decisão. Aprovação envia exatamente o texto proposto, conferido pelo hash. */
export async function aplicarDecisao(p: PedidoProcesso, c: Extract<ComandoRevisora, { acao: 'aprovar' | 'corrigir' | 'recusar' }>, por: string, canal: 'revisora' | 'manager', agora: Date): Promise<DecisaoAplicada> {
  if (p.status !== 'pendente' || p.codigo !== c.codigo) throw new Error('Pedido não está pendente.');
  const em = agora.toISOString();
  if (c.acao === 'recusar') return { pedido: { ...p, status: 'recusado', decisao: { por, canal, em } }, pausarAna: true };
  const texto = c.acao === 'aprovar' ? p.textoProposto : c.texto;
  const hash = await hashTexto(texto);
  if (c.acao === 'aprovar' && hash !== p.hash) throw new Error('O texto aprovado não confere com o hash do pedido. Nada foi enviado.');
  return { pedido: { ...p, status: c.acao === 'aprovar' ? 'aprovado' : 'corrigido', decisao: { por, canal, em, textoEnviado: texto, hashEnviado: hash } }, enviarCliente: texto, pausarAna: false };
}

/** Pendências: lembrete à revisora a cada intervalo (até o máximo) e um aviso de retorno ao cliente. */
export function pendencias(p: PedidoProcesso, agora: Date, cfg: ConfigConsultaProcesso = CONFIG_CONSULTA_PADRAO): { lembrete: boolean; avisoCliente?: string } {
  if (p.status !== 'pendente') return { lembrete: false };
  const ultimo = Date.parse(p.lembretesEm.at(-1) ?? p.criadoEm);
  const lembrete = p.lembretesEm.length < cfg.maxLembretes && agora.getTime() - ultimo >= cfg.lembreteMin * 60000;
  const aviso = !p.avisoRetornoEm && agora.getTime() - Date.parse(p.criadoEm) >= cfg.avisoRetornoMin * 60000;
  return { lembrete, ...(aviso ? { avisoCliente: TEXTOS_CONSULTA.avisoRetorno(agora) } : {}) };
}

/** Só vale a resposta da revisora cadastrada no servidor ou de sênior/admin pelos botões do Manager ADV. */
export function respostaAutorizada(origem: { canal: 'whatsapp' | 'telegram'; contato: string } | { canal: 'manager'; papeis: string[] }, contatoRevisora: string | undefined): boolean {
  if (origem.canal === 'manager') return origem.papeis.some(p => p === 'admin' || p === 'advogada_senior');
  if (!contatoRevisora?.trim()) return false;
  return origem.canal === 'whatsapp' ? mesmoTelefone(origem.contato, contatoRevisora) : origem.contato.trim() === contatoRevisora.trim();
}

/** Insistência sem texto ("??", "?!") ou cobrança curta ("oi?", "alô?"): enquanto houver pedido pendente, recebe "em conferência". */
export function apenasInsistencia(texto: string): boolean {
  const t = fold(texto).trim();
  return /^[?!.\s]+$/.test(t) && /[?!]/.test(t) || /^(?:oi|ola|alo|opa|hein|e ai|e entao|entao)\s*[?!]+[\s?!]*$/.test(t);
}

/** Cliente escreve enquanto o pedido aguarda: assunto de processo recebe "em conferência"; o resto segue o fluxo normal. */
export function respostaDuranteEspera(texto: string, intencao: string, temPendente: boolean): string | undefined {
  if (!temPendente) return undefined;
  const t = fold(texto);
  const agenda = intencao === 'agendamento' || /\b(?:agendar|marcar|remarcar|cancelar)\b.{0,30}\b(?:consulta|reuniao|horario)\b|\bconsulta\b.{0,20}\b(?:agendar|marcar)\b/.test(t);
  if (agenda) return undefined;
  if (apenasInsistencia(texto)) return TEXTOS_CONSULTA.emConferencia;
  const processo = intencao === 'consulta_processo' || intencao === 'processo' || pedidoNoticiaProcesso(texto) || /\b(?:e ai|e entao|alguma (?:novidade|noticia|resposta)|ja (?:tem|teve)|cade|demora|esperando|ninguem me (?:fala|responde)|retorno)\b/.test(t);
  return processo ? TEXTOS_CONSULTA.emConferencia : undefined;
}

// ---------- Pedido de notícia de processo reconhecido pelo servidor ----------
/** Reforço do servidor para não depender só da classificação do modelo. Pergunta de significado ou de chance não entra. */
export function pedidoNoticiaProcesso(texto: string): boolean {
  const t = fold(texto);
  if (/signific|quer dizer|o que e|vou ganhar|chance|ganho|perco|honorari|valor|quanto|pagamento|boleto/.test(t)) return false;
  return /\b(?:como (?:ta|esta|anda|vai)|novidade|noticia|andamento|movimenta|atualiza|alguma coisa|status)\b.{0,40}\b(?:processo|caso|acao|audiencia)\b|\b(?:meu|minha|do meu|da minha|o meu)\s+(?:processo|caso|acao)\b.{0,30}\b(?:como|andou|andamento|novidade|ta|esta|anda)\b|\bnoticias?\s+(?:do|da|de)\s+(?:processo|caso|acao)|\btem\s+audiencia\b|\baudiencia\s+marcada\b/.test(t);
}

/** Pedido sobre terceiro (irmão, mãe, outra pessoa): nunca consulta; a equipe trata. */
export function pedidoSobreTerceiro(texto: string): boolean {
  return /\b(?:irma|irmao|mae|pai|filh[oa]s?|espos[oa]|marido|mulher|namorad[oa]|amig[oa]|prim[oa]|ti[oa]|avo|cunhad[oa]|sogr[oa]|outra pessoa|de outra pessoa|dele|dela)\b/.test(fold(texto));
}

/** Pedido para gravar, apagar, ver documento, significado, chance ou valores: não é consulta de notícia. */
function foraDaConsulta(texto: string): boolean {
  return /signific|quer dizer|o que e (?:isso|esse|essa)|vou ganhar|chance|ganho|perco|honorari|quanto|valor|pagamento|boleto|copia|documento|arquivo|pdf|sentenca na integra|cadastr|apag|exclu|alter[ae]|mud[ae] (?:meu|o)|atualiz[ae] (?:meu|o) (?:telefone|endereco)/.test(fold(texto));
}

/** Decide se a mensagem vai para a consulta ao ProJuris (mesma regra no servidor e no simulador). */
export function deveConsultarProcesso(e: { intencao: string; texto: string; encaminharHumano: boolean; aguardandoAssunto: boolean }): boolean {
  if (e.encaminharHumano || foraDaConsulta(e.texto) || pedidoSobreTerceiro(e.texto)) return false;
  if (e.aguardandoAssunto) return true;
  return e.intencao === 'consulta_processo' || pedidoNoticiaProcesso(e.texto);
}

/** Não cliente pedindo notícia de processo: fluxo atual (passagem para a equipe), sem revelar nada. */
export function mensagemNaoCliente(agora: Date): string {
  return `Por aqui eu cuido só dos agendamentos, então passei sua conversa para a equipe.\n${frasePrazo(agora)}`;
}

// ---------- Roteiro da consulta ----------
export interface EntradaRedacao { primeiro_nome: string; processos: ReturnType<typeof fatosParaRedacao>['processos'] }
export interface PortasConsulta {
  agora(): Date;
  identificar(telefone: string): Promise<Identificacao>;
  processosAtivos(codigoPessoa: number): Promise<ProcessoPJ[]>;
  ultimosAndamentos(codigoProcesso: number): Promise<AndamentoLegivel[]>;
  redigir(entrada: EntradaRedacao): Promise<string>;
  codigosExistentes(): Promise<string[]>;
  avisarCliente(texto: string): Promise<void>;
  enviarRevisora(texto: string): Promise<void>;
  /** Auditoria técnica, sem dados pessoais. */
  registrar(evento: string, detalhe?: string): Promise<void>;
  /** Busca por CPF no ProJuris (só leitura). Sem esta porta, telefone não encontrado segue o fluxo antigo. */
  buscarPorCpf?(cpf: string): Promise<PessoaCpf[]>;
}
export type ResultadoConsulta =
  | { tipo: 'nao_cliente' }
  | { tipo: 'perguntar_assunto'; mensagem: string; codigoPessoa: number }
  | { tipo: 'equipe'; mensagem: string; motivo: string }
  | { tipo: 'pedir_cpf'; mensagem: string }
  | { tipo: 'vinculo_pendente'; mensagem: string; vinculo: VinculoProjuris }
  | { tipo: 'pedido'; pedido: PedidoProcesso; vinculo?: VinculoProjuris };

export async function iniciarConsultaProcesso(
  e: { conversaId: string; telefone: string; nomeContato: string; textoCliente: string; assuntoJaPerguntado: boolean; vinculo?: VinculoProjuris | undefined; aguardandoCpf?: boolean; perguntaOriginal?: string | undefined },
  portas: PortasConsulta,
  cfg: ConfigConsultaProcesso = CONFIG_CONSULTA_PADRAO,
): Promise<ResultadoConsulta> {
  const equipe = async (motivo: string): Promise<ResultadoConsulta> => { await portas.registrar('consulta_processo_equipe', motivo); return { tipo: 'equipe', mensagem: TEXTOS_CONSULTA.equipe(portas.agora()), motivo }; };
  if (!cfg.aprovacao_processo) return equipe('envio sem aprovação ainda não liberado');
  if (cfg.verificacao_processo) return equipe('verificação extra ligada, mas ainda não implementada');
  try {
    let pessoa: { codigo: number; nome: string };
    let novoVinculo: VinculoProjuris | undefined;
    let identificadoPor = 'telefone principal no ProJuris (cadastro único)';
    if (e.vinculo?.status === 'pendente') return { tipo: 'vinculo_pendente', mensagem: TEXTOS_VINCULO.pendente, vinculo: e.vinculo };
    if (e.vinculo?.status === 'confirmado') {
      pessoa = { codigo: e.vinculo.codigoPessoa, nome: e.vinculo.nome };
      identificadoPor = e.vinculo.origem === 'cpf' ? 'vínculo por CPF confirmado pela equipe' : 'vínculo gravado na conversa (telefone principal)';
    } else if (e.aguardandoCpf && portas.buscarPorCpf) {
      const cpf = cpfNoTexto(e.textoCliente);
      if (!cpf) return { tipo: 'pedir_cpf', mensagem: TEXTOS_VINCULO.pedirCpf };
      const achada = pessoaPorCpf(cpf, await portas.buscarPorCpf(cpf));
      if (!achada) { await portas.registrar('consulta_processo_nao_cliente', 'cpf sem cadastro único'); return { tipo: 'nao_cliente' }; }
      await portas.registrar('vinculo_cpf_pendente');
      return { tipo: 'vinculo_pendente', mensagem: TEXTOS_VINCULO.pendente, vinculo: vinculoPendentePorCpf(achada, cpf, portas.agora()) };
    } else {
      const id = await portas.identificar(e.telefone);
      if (id.tipo !== 'unico' && portas.buscarPorCpf) { await portas.registrar('consulta_processo_pedir_cpf', id.tipo); return { tipo: 'pedir_cpf', mensagem: TEXTOS_VINCULO.pedirCpf }; }
      if (id.tipo === 'telefone_invalido' || id.tipo === 'nao_encontrado') { await portas.registrar('consulta_processo_nao_cliente', id.tipo); return { tipo: 'nao_cliente' }; }
      if (id.tipo === 'duplicado') return equipe(`telefone principal em ${id.codigos.length} pessoas`);
      pessoa = id.pessoa;
      novoVinculo = vinculoPorTelefone(id.pessoa, portas.agora());
    }
    const textoEscolha = e.perguntaOriginal?.trim() || e.textoCliente;
    const ativos = await portas.processosAtivos(pessoa.codigo);
    if (!ativos.length) return equipe('nenhum processo ativo como cliente');
    const escolha = escolherProcessos(ativos, e.assuntoJaPerguntado ? e.textoCliente : textoEscolha);
    if (escolha.criterio === 'indefinido' && !e.assuntoJaPerguntado) return { tipo: 'perguntar_assunto', mensagem: TEXTOS_CONSULTA.perguntaAssunto, codigoPessoa: pessoa.codigo };
    if (escolha.escolhidos.every(p => !podeDetalhar(p))) return equipe('segredo de justiça');
    await portas.avisarCliente(TEXTOS_CONSULTA.aviso);
    const fatos: FatoProcesso[] = [];
    for (const p of escolha.escolhidos) fatos.push(fatoDe(p, podeDetalhar(p) ? await portas.ultimosAndamentos(p.codigo) : []));
    let texto = '';
    let padrao = false;
    try { texto = (await portas.redigir(fatosParaRedacao(pessoa.nome, fatos))).trim(); } catch { texto = ''; }
    const validacao = validarRascunho(texto, fatos);
    if (!validacao.ok) { await portas.registrar('rascunho_substituido', validacao.problemas.join('; ')); texto = rascunhoPadrao(pessoa.nome, fatos); padrao = true; }
    const pedido: PedidoProcesso = {
      codigo: proximoCodigo(await portas.codigosExistentes()),
      conversaId: e.conversaId,
      contato: { nome: pessoa.nome, telefone: e.telefone },
      identificadoPor,
      processos: fatos,
      textoProposto: texto,
      hash: await hashTexto(texto),
      rascunhoPadrao: padrao,
      status: 'pendente',
      criadoEm: portas.agora().toISOString(),
      lembretesEm: [],
    };
    await portas.enviarRevisora(mensagemRevisora(pedido));
    await portas.registrar('pedido_aprovacao_criado', `${pedido.codigo} · ${fatos.length} processo(s) · ${escolha.criterio}`);
    return { tipo: 'pedido', pedido, ...(novoVinculo ? { vinculo: novoVinculo } : {}) };
  } catch (erro) {
    const tipo = erro instanceof Error && 'tipo' in erro ? String((erro as { tipo: unknown }).tipo) : 'falha';
    return equipe(`falha na consulta ao ProJuris (${tipo})`);
  }
}
