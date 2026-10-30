// Motor da Ana: recebe a mensagem do cliente, chama o Claude com o prompt e as ferramentas,
// aplica as regras reais e as garantias da página e devolve o que vai para o cliente.
// A conversa da página e a bateria de testes usam este mesmo código.
import { z } from 'zod';
import type { AIMode } from './base';
import { dataHoraCurta } from './base';
import { aplicarRegrasAna, anaSchema, expedienteAna, mensagemSemResposta, type AnaResult } from './regras';
import {
  CONFIG_AGENDA, FUSO_BRASILIA, documentosSugeridos, emailValido, escolhaDoCliente, escolherOpcoes, filtrarPorPreferencia, fusoValido, horaCurta,
  horariosDoDia, linhasOpcoes, nomeCompletoValido, proximoDiaUtil, rotuloCompleto, rotuloDia, rotuloRelativo, citaHorarioDeConsulta,
} from './agenda';
import { INSTRUCOES_ANA } from './prompt';
import { apagarEvento, criarConsulta, ErroAgenda, horarioAindaLivre, horariosLivres, traduzirErro, type Mcp } from './agenda-mcp';

export type Turno = { role: 'user' | 'assistant'; content: string };
export type Consulta = { inicio: string; id: string; meet: string };
export type EstadoAna = {
  dados: AnaResult['dados_coletados']; apresentado: boolean; equipeAvisada: boolean;
  mostrados: string[]; ultimasOpcoes: string[]; escolhido?: string | undefined; consulta?: Consulta | undefined;
  fuso: string; local: string;
  remarcando?: boolean; primeiroNome?: string; menor?: boolean; avisouMenor?: boolean; agradeceu?: boolean; ofereceuForaDaArea?: boolean;
};
export type Decisao = { acao: AnaResult['acao']; intencao: AnaResult['intencao']; proximo: string; motivo: string; urgente: boolean; equipe: boolean; rascunho?: string; ferramentas: string[]; ajustes: string[] };
export type SampleFn = ((input: unknown, opts?: unknown) => Promise<{ text: string }>) & { json: (input: unknown, opts?: unknown) => Promise<unknown>; limits: () => Promise<{ tools?: { maxCount: number } }> };
export interface Conversa { estado: EstadoAna; historico: Turno[]; anaMsgs: string[] }
export interface Motor {
  sample: SampleFn; mcp: Mcp | null; ferramentasOk: boolean;
  modo: AIMode; nivel: 'quick' | 'default'; convite: boolean; agora: () => Date;
  log?: (t: string, tipo?: 'ok' | 'aviso' | 'erro') => void;
  atividade?: (t: string) => void;
  aoMostrar?: (slots: string[]) => void;
  aoReservar?: (c: Consulta) => void;
  aoApagar?: (id: string) => void;
}
export interface Resposta { conversa: Conversa; blocos: string[]; decisao?: Decisao; avisouEquipe: boolean; semResposta?: string }

export const respostaSchema = anaSchema.extend({
  horario_escolhido: z.string().optional().default(''),
  fuso_cliente: z.string().optional().default(''),
  local_cliente: z.string().optional().default(''),
});
const vazio = { nome: '', cpf: '', assunto: '', email: '' };
export const conversaNova = (): Conversa => ({ estado: { dados: vazio, apresentado: false, equipeAvisada: false, mostrados: [], ultimasOpcoes: [], fuso: FUSO_BRASILIA, local: '' }, historico: [], anaMsgs: [] });

const mascararCpf = (t: string) => t.replace(/\b\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}\b/g, c => `••••••••${c.replace(/\D/g, '').slice(-3)}`);
const palavras = (t: string) => new Set(t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w.length > 2));
/** Semelhança entre duas mensagens (0 a 1), pelas palavras em comum. */
export function semelhanca(a: string, b: string) { const A = palavras(a), B = palavras(b); if (!A.size || !B.size) return 0; let c = 0; for (const w of A) if (B.has(w)) c++; return c / Math.max(A.size, B.size); }
const maiuscula = (t: string) => t.replace(/^./, c => c.toUpperCase());
const AFIRMA = /^(?:sim|pode|pode sim|confirmo|isso|quero|pode cancelar|cancela|cancelar|s|ss|claro|por favor|ok,? pode)\b/i;

/** Confirmação completa montada pela página, usada se a do Claude vier incompleta. */
export function confirmacaoPadrao(c: Consulta, email: string, assunto: string, convite: boolean, tz: string, remarcada = false) {
  return [
    remarcada ? 'Pronto, remarcado:' : 'Pronto, está confirmado:',
    `${maiuscula(rotuloCompleto(c.inicio, tz))}, consulta online com a Dra. Carolina (30 min)`,
    convite ? `O link do Google Meet foi para ${email}.` : `Link do Google Meet: ${c.meet}`,
    `Se puder, deixe à mão: ${documentosSugeridos(assunto)}.`,
    'Se precisar remarcar, é só me chamar aqui.',
  ].join('\n');
}

/** Lugares fora do Brasil citados pelo cliente → fuso. Garante a conversão mesmo se o modelo esquecer. */
const LUGARES: [RegExp, string, string][] = [
  [/\b(lisboa|portugal|coimbra|braga|faro|algarve|\bporto\b(?!\s*(alegre|seguro|velho|nacional|belo|feliz|real|ferreira|uniao|franco|murtinho|esperanca|grande)))/, 'Europe/Lisbon', 'Portugal'],
  [/\b(dubai|abu dhabi|emirados|sharjah)\b/, 'Asia/Dubai', 'Dubai'],
  [/\b(londres|inglaterra|reino unido|london)\b/, 'Europe/London', 'Reino Unido'],
  [/\b(madri|madrid|barcelona|espanha)\b/, 'Europe/Madrid', 'Espanha'],
  [/\b(paris|franca)\b/, 'Europe/Paris', 'França'],
  [/\b(italia|roma|milao)\b/, 'Europe/Rome', 'Itália'],
  [/\b(alemanha|berlim|munique|frankfurt)\b/, 'Europe/Berlin', 'Alemanha'],
  [/\b(irlanda|dublin)\b/, 'Europe/Dublin', 'Irlanda'],
  [/\b(suica|zurique|genebra)\b/, 'Europe/Zurich', 'Suíça'],
  [/\b(nova york|new york|boston|miami|orlando|flórida|florida|eua|estados unidos)\b/, 'America/New_York', 'Estados Unidos (leste)'],
  [/\b(california|los angeles|san francisco)\b/, 'America/Los_Angeles', 'Estados Unidos (oeste)'],
  [/\b(toronto|canada|montreal)\b/, 'America/Toronto', 'Canadá'],
  [/\b(japao|toquio)\b/, 'Asia/Tokyo', 'Japão'],
];
export function localDoTexto(texto: string): { fuso: string; local: string } | undefined {
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/\b(estou|moro|to|tô|vivo|aqui (em|no|na)|daqui|resido|morando|fico)\b|\bem (lisboa|portugal|dubai|londres)/.test(t)) return undefined;
  for (const [re, fuso, local] of LUGARES) if (re.test(t)) return { fuso, local };
  return undefined;
}

export async function responder(m: Motor, conv: Conversa, texto: string, sinal?: AbortSignal): Promise<Resposta> {
  const t = texto.trim();
  let est: EstadoAna = { ...conv.estado };
  const log = m.log ?? (() => {});
  const atividade = m.atividade ?? (() => {});
  const agora = m.agora();
  const folded = t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (mensagemSemResposta(t) && !est.escolhido && !/cancel/i.test(conv.anaMsgs.at(-1) ?? '')) {
    // Agradecimento logo depois da confirmação: uma frase curta, uma vez só, sem chamar o Claude.
    if (est.consulta && /confirmad|remarcad/i.test(conv.anaMsgs.at(-1) ?? '') && !est.agradeceu) {
      const msg = 'Imagina! Qualquer coisa, é só me chamar aqui.';
      return {
        conversa: { estado: { ...est, agradeceu: true }, anaMsgs: [...conv.anaMsgs, msg], historico: [...conv.historico, { role: 'user' as const, content: `MENSAGEM DO CLIENTE: ${t}` }, { role: 'assistant' as const, content: JSON.stringify({ acao: 'enviar', mensagem: msg }) }] },
        blocos: [msg], avisouEquipe: false,
        decisao: { acao: 'enviar', intencao: 'outro', proximo: '', motivo: '', urgente: false, equipe: false, ferramentas: [], ajustes: ['Agradecimento respondido pela página'] },
      };
    }
    return { conversa: conv, blocos: [], avisouEquipe: false, semResposta: 'Mensagem sem pergunta (“ok”, “obrigado”): Ana não responde' };
  }

  const lugar = localDoTexto(t);
  if (lugar && lugar.fuso !== est.fuso) { est = { ...est, fuso: lugar.fuso, local: lugar.local }; log(`Cliente fora do Brasil: ${lugar.local}`); }
  // Mesma mensagem pela 3ª vez ou mais: muda para uma pergunta de sim ou não, sem chamar o Claude.
  const clientes = conv.historico.filter(h => h.role === 'user').map(h => h.content.replace(/^MENSAGEM DO CLIENTE: /, '').trim().toLowerCase());
  let repeticoes = 0;
  for (let i = clientes.length - 1; i >= 0 && clientes[i] === t.toLowerCase(); i--) repeticoes++;
  if (repeticoes >= 2 && !est.escolhido) {
    const opcoes = [
      'Só para eu te ajudar melhor: você quer marcar uma consulta com a Dra. Carolina? Pode responder só sim ou não.',
      'Se preferir, posso pedir para alguém da equipe falar com você por aqui. Quer?',
      'Estou por aqui. Quando quiser, é só me contar como posso ajudar.',
    ];
    const msg = opcoes[Math.min(repeticoes - 2, opcoes.length - 1)]!;
    return {
      conversa: { estado: { ...est, apresentado: true }, anaMsgs: [...conv.anaMsgs, msg], historico: [...conv.historico, { role: 'user' as const, content: `MENSAGEM DO CLIENTE: ${t}` }, { role: 'assistant' as const, content: JSON.stringify({ acao: 'enviar', mensagem: msg }) }] },
      blocos: [msg], avisouEquipe: false,
      decisao: { acao: 'enviar', intencao: 'duvida_geral', proximo: '', motivo: '', urgente: false, equipe: false, ferramentas: [], ajustes: ['Mensagem repetida: pergunta direta feita pela página'] },
    };
  }
  // Sinais lidos do texto pelo código, antes do modelo.
  const anteriorCliente = [...conv.historico].reverse().find(h => h.role === 'user')?.content.replace(/^MENSAGEM DO CLIENTE: /, '') ?? '';
  const repetiu = Boolean(anteriorCliente) && anteriorCliente.trim().toLowerCase() === t.toLowerCase();
  const fimDeSemana = /\b(sabado|domingo|fim de semana|final de semana)\b/.test(folded);
  if (/\btenho (1[0-7]|[1-9]) anos\b|\bsou menor\b|\bmenor de idade\b/.test(folded)) est = { ...est, menor: true };
  const nomeDito = /(?:sou (?:a|o)|me chamo|meu nome (?:é|e))\s+([A-ZÀ-Ú][a-zà-ú]+)/.exec(t)?.[1];
  if (nomeDito) est = { ...est, primeiroNome: nomeDito };
  const emailTexto = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/.exec(t)?.[0]?.replace(/[.,;!?]+$/, '');
  if (emailTexto && emailValido(emailTexto)) est = { ...est, dados: { ...est.dados, email: emailTexto } };
  const querMudar = /\b(outro|outra|na verdade|mudar|prefiro|cancel\w*|nao (quero|posso|vou)|espera)\b/.test(folded);
  const escolhidoAntes = est.escolhido;
  if (querMudar) est = { ...est, escolhido: undefined };
  else { const pick = escolhaDoCliente(est.ultimasOpcoes, t); if (pick) est = { ...est, escolhido: pick }; }
  // Nome respondido logo depois de a Ana pedir: guarda mesmo se o modelo esquecer de registrar.
  const pediuNome = /nome/i.test(conv.anaMsgs.at(-1) ?? '') || Boolean(est.escolhido) || est.ultimasOpcoes.length > 0;
  const candidatoNome = t.replace(/^(meu nome (?:é|e)|me chamo|sou (?:a|o))\s+/i, '').split(/[,;]| e meu| meu e-?mail/i)[0]!.trim();
  if (pediuNome && !est.dados.nome && candidatoNome.split(/\s+/).length <= 6 && nomeCompletoValido(candidatoNome) && !/\b(quero|preciso|nao|sim|pode|obrigad|tenho|estou)\b/i.test(candidatoNome))
    est = { ...est, dados: { ...est.dados, nome: candidatoNome } };
  const ultimaAna = conv.anaMsgs.at(-1) ?? '';
  const usadas: string[] = [];
  let reservada: Consulta | undefined; let remarcou = false; let cancelou = false; let ocupadoNaReserva = false; let agendaFalhou = false;
  const mcp = m.ferramentasOk ? m.mcp : null;
  const op = (i: string) => ({ inicio: i, rotulo: rotuloRelativo(i, agora, est.fuso) });
  const mostrar = (slots: string[]) => { est = { ...est, ultimasOpcoes: slots, mostrados: [...new Set([...est.mostrados, ...slots])] }; m.aoMostrar?.(slots); };
  const exigeAutomatica = () => { if (m.modo !== 'Automática') throw new Error('Modo diferente de Automática: não mexa na agenda. Deixe como rascunho para a equipe.'); };
  const falhaAgenda = (e: unknown, acao: string) => {
    if (e instanceof Error && !(e instanceof ErroAgenda)) return e;
    const x = e instanceof ErroAgenda ? e : traduzirErro(e);
    agendaFalhou = true;
    log(`Falha ao ${acao}: ${x.message}`, 'erro');
    return new Error(`Agenda indisponível (${x.codigo}). Não ofereça nem confirme nada. Diga que o pedido ficou registrado e que a equipe vai chamar; marque encaminhar_humano.`);
  };
  const usarFuso = (input: Record<string, unknown>) => {
    const f = String(input['fuso_cliente'] ?? '').trim();
    if (f && fusoValido(f) && f !== est.fuso) { est = { ...est, fuso: f }; log(`Fuso do cliente: ${f}`); }
  };
  // E-mail só vale se a pessoa escreveu exatamente assim: nunca "corrigir" por conta própria.
  const textosCliente = [...conv.historico.filter(h => h.role === 'user').map(h => h.content.replace(/^MENSAGEM DO CLIENTE: /, '')), t].map(x => x.toLowerCase());
  const emailDoCliente = (email: string) => Boolean(email) && textosCliente.some(x => x.includes(email.toLowerCase()));
  const doMostrado = (inicio: string) => est.mostrados.find(o => Date.parse(o) === Date.parse(inicio));

  const contexto = () => ({
    data_hora_atual: agora.toLocaleString('pt-BR', { timeZone: FUSO_BRASILIA, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' (Brasília)',
    dentro_expediente: expedienteAna(agora), proximo_dia_util: proximoDiaUtil(agora), modo_ia: m.modo, apresentado: est.apresentado,
    cliente: est.dados, equipe_ja_avisada: est.equipeAvisada,
    local_do_cliente: est.local || (est.fuso === FUSO_BRASILIA ? 'Brasil (presumido)' : est.fuso), fuso_do_cliente: est.fuso,
    horarios_oferecidos: est.ultimasOpcoes.map(op),
    horario_escolhido: est.escolhido ? op(est.escolhido) : null,
    consulta_marcada: est.consulta ? { quando: rotuloCompleto(est.consulta.inicio, est.fuso), meet: est.consulta.meet } : null,
    consulta_info: `consulta online de ${CONFIG_AGENDA.duracaoMin} minutos com a Dra. Carolina, pelo Google Meet. É gratuita`,
    suas_ultimas_mensagens: conv.anaMsgs.slice(-4),
    cliente_repetiu_a_mensagem: repetiu,
    pediu_fim_de_semana: fimDeSemana,
    cliente_menor_de_idade: Boolean(est.menor),
    remarcando: Boolean(est.remarcando),
    temas_proibidos_extra: [],
  });

  const buscar = {
    name: 'buscar_horarios_livres',
    description: 'Lê a agenda real e devolve opções livres para a consulta de 30 min, em até 3 dias diferentes, no fuso do cliente: {linhas, opcoes:[{inicio, rotulo}]}. Não exige nome nem e-mail.',
    inputSchema: { type: 'object', properties: { preferencia: { type: 'string', description: '"manhã", "tarde" ou vazio (horário de Brasília).' }, excluir_oferecidos: { type: 'boolean', description: 'true quando a pessoa pediu outras opções.' }, para_remarcar: { type: 'boolean', description: 'true quando a pessoa quer remarcar a consulta já marcada.' }, outro_dia: { type: 'boolean', description: 'true quando a pessoa disse que não pode no dia escolhido ou marcado.' }, fuso_cliente: { type: 'string', description: 'Fuso IANA se a pessoa está fora do Brasil ("Europe/Lisbon"); vazio se no Brasil.' } } },
    execute: async (input: Record<string, unknown>) => {
      usadas.push('buscar_horarios_livres');
      usarFuso(input);
      if (est.consulta && input['para_remarcar'] !== true) throw new Error(`Já existe consulta marcada (${rotuloCompleto(est.consulta.inicio, est.fuso)}). Se a pessoa quer remarcar, chame de novo com para_remarcar=true.`);
      atividade('Ana está consultando a agenda…');
      try {
        const livres = await horariosLivres(mcp!, agora);
        const pref = filtrarPorPreferencia(livres, String(input['preferencia'] ?? ''));
        if (input['para_remarcar'] === true) est = { ...est, remarcando: true };
        // "Outro dia": tira o dia já escolhido ou marcado, mesmo se o modelo esquecer de pedir.
        const outroDia = input['outro_dia'] === true || /outro dia|outra data|nesse dia nao|nao (vou )?(poder|conseguir)( ir)? (nesse|neste|no|esse|nesse mesmo) dia|nao vou poder/.test(folded);
        const diaSP = (x: string) => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_BRASILIA }).format(new Date(x));
        const diasFora = new Set(outroDia ? [escolhidoAntes, est.consulta?.inicio].filter((x): x is string => Boolean(x)).map(diaSP) : []);
        const semDia = (l: string[]) => l.filter(x => !diasFora.has(diaSP(x)));
        const base = semDia(pref.temPreferencia && pref.filtrados.length ? pref.filtrados : livres);
        // Uma opção por dia: "a primeira", "a segunda" nunca ficam ambíguas.
        let opcoes = escolherOpcoes(base, 3, input['excluir_oferecidos'] === true ? est.mostrados : [], 3);
        if (!opcoes.length) opcoes = escolherOpcoes(base, 3, [], 3);
        mostrar(opcoes);
        log(`Agenda consultada: ${opcoes.length} horários em ${linhasOpcoes(opcoes, agora, est.fuso).length} dias`);
        if (!opcoes.length) return { opcoes: [], orientacao: 'Sem horários livres nos próximos 10 dias úteis: diga que a equipe vai chamar para marcar e marque encaminhar_humano.' };
        return { linhas: linhasOpcoes(opcoes, agora, est.fuso), opcoes: opcoes.map(op), sem_horario_no_periodo: pref.temPreferencia && !pref.filtrados.length };
      } catch (e) { throw falhaAgenda(e, 'ler a agenda'); } finally { atividade(''); }
    },
  };
  const doDia = {
    name: 'horarios_do_dia',
    description: 'Horários livres (até 4) do dia mais próximo que a pessoa pediu ("sexta", "amanhã", "30/10", "segunda de manhã"): {dia, manha, tarde, opcoes:[{inicio, rotulo}]}.',
    inputSchema: { type: 'object', properties: { dia: { type: 'string', description: 'O dia como a pessoa disse.' }, hora: { type: 'string', description: 'Horário específico pedido ("16h", "9h30"), em Brasília; vazio se não houver.' }, fuso_cliente: { type: 'string', description: 'Fuso IANA se a pessoa está fora do Brasil; vazio se no Brasil.' } }, required: ['dia'] },
    execute: async (input: Record<string, unknown>) => {
      usadas.push('horarios_do_dia');
      usarFuso(input);
      atividade('Ana está olhando o dia na agenda…');
      try {
        const livres = await horariosLivres(mcp!, agora);
        const r = horariosDoDia(livres, String(input['dia'] ?? ''), agora);
        // Horário específico pedido: se estiver livre nesse dia, entra na lista mesmo que não estivesse entre os 4.
        const hm = /(\d{1,2})(?:h|:)(\d{2})?/.exec(String(input['hora'] ?? ''));
        let pedido: string | undefined; let pedidoLivre = false;
        if (r?.dia && hm) {
          pedido = new Date(`${r.dia}T${hm[1]!.padStart(2, '0')}:${hm[2] ?? '00'}:00-03:00`).toISOString();
          pedidoLivre = livres.includes(pedido);
          if (pedidoLivre && !r.slots.includes(pedido)) r.slots = [...r.slots.slice(0, 3), pedido].sort();
        }
        if (!r) return { orientacao: 'Não entendi qual dia. Pergunte de forma objetiva qual dia a pessoa prefere.' };
        if (!r.slots.length) return { orientacao: 'Esse dia não tem horário livre (ou é fim de semana). Diga isso com leveza e ofereça as opções de buscar_horarios_livres.' };
        mostrar(r.slots);
        log(`Horários de ${r.dia.split('-').reverse().slice(0, 2).join('/')} consultados`);
        const h = (s: string) => Number(horaCurta(s).split('h')[0]);
        return { ...(pedido ? { horario_pedido: rotuloRelativo(pedido, agora, est.fuso), horario_pedido_livre: pedidoLivre } : {}), linha: linhasOpcoes(r.slots, agora, est.fuso)[0], orientacao: 'Mostre os horários do dia numa linha só, copiando "linha" (ex.: "amanhã (qui, 29/10) às 8h, 8h30 ou 11h"); não repita o dia em cada horário.', dia: rotuloDia(r.slots[0]!, agora, est.fuso), manha: r.slots.filter(s => h(s) < 12).map(s => horaCurta(s, est.fuso)), tarde: r.slots.filter(s => h(s) >= 12).map(s => horaCurta(s, est.fuso)), opcoes: r.slots.map(op) };
      } catch (e) { throw falhaAgenda(e, 'ler o dia'); } finally { atividade(''); }
    },
  };
  const dadosValidos = (input: Record<string, unknown>) => {
    const nome = String(input['nome'] ?? '').trim() || est.dados.nome;
    const email = String(input['email'] ?? '').trim() || est.dados.email;
    const assunto = String(input['assunto'] ?? '').trim() || est.dados.assunto;
    if (!nomeCompletoValido(nome)) throw new Error('Nome incompleto ou com números. Peça com leveza o nome completo, como está no documento, sem agradecer pela correção.');
    if (!emailValido(email)) throw new Error('E-mail inválido. Explique de forma simples e dê o exemplo nome@provedor.com, sem espaços.');
    if (!emailDoCliente(email)) throw new Error('A pessoa não escreveu esse e-mail exatamente assim (o que ela mandou tinha espaço ou erro). Não corrija por conta própria: peça com leveza para ela conferir e mandar de novo, sem espaços, no formato nome@provedor.com.');
    return { nome, email, assunto };
  };
  const reservar = async (inicio: string, dados: { nome: string; email: string; assunto: string }) => {
    const oferecido = doMostrado(inicio);
    if (!oferecido) throw new Error('Esse horário não veio da agenda. Chame buscar_horarios_livres ou horarios_do_dia e ofereça de novo.');
    if (!(await horarioAindaLivre(mcp!, oferecido))) {
      est = { ...est, escolhido: undefined, mostrados: est.mostrados.filter(o => o !== oferecido), ultimasOpcoes: est.ultimasOpcoes.filter(o => o !== oferecido) };
      log('Horário escolhido foi ocupado antes da reserva', 'aviso');
      ocupadoNaReserva = true;
      throw new Error('Esse horário acabou de ser ocupado. Avise com leveza e chame buscar_horarios_livres com excluir_oferecidos=true.');
    }
    const ev = await criarConsulta(mcp!, { inicio: oferecido, ...dados, convite: m.convite });
    return { inicio: oferecido, id: ev.id, meet: ev.meet };
  };
  const retornoReserva = (c: Consulta, d: { email: string; assunto: string }) => ({
    ok: true, quando: maiuscula(rotuloCompleto(c.inicio, est.fuso)), email: d.email, convite_por_email: m.convite, meet_link: c.meet, documentos_sugeridos: documentosSugeridos(d.assunto || est.dados.assunto),
  });

  const marcar = {
    name: 'marcar_consulta',
    description: 'Reserva na agenda real o horário escolhido, com Google Meet. Devolve {ok, quando, email, convite_por_email, meet_link, documentos_sugeridos}. "inicio" precisa ser exatamente um dos devolvidos pelas ferramentas.',
    inputSchema: { type: 'object', properties: { inicio: { type: 'string' }, nome: { type: 'string', description: 'Nome completo.' }, email: { type: 'string' }, assunto: { type: 'string' } }, required: ['inicio', 'nome', 'email'] },
    execute: async (input: Record<string, unknown>) => {
      usadas.push('marcar_consulta');
      exigeAutomatica();
      if (est.consulta) throw new Error('Já existe consulta marcada. Para mudar, use remarcar_consulta.');
      const dados = dadosValidos(input);
      atividade('Ana está marcando a consulta…');
      try {
        const c = await reservar(String(input['inicio'] ?? ''), dados);
        reservada = c;
        est = { ...est, consulta: c, escolhido: undefined, ultimasOpcoes: [], dados: { ...est.dados, nome: dados.nome, email: dados.email, assunto: est.dados.assunto || dados.assunto } };
        m.aoReservar?.(c);
        log(`Consulta criada no Google Calendar · ${dataHoraCurta(c.inicio)}${m.convite ? ' · convite enviado' : ' · sem convite por e-mail'}`);
        return retornoReserva(c, dados);
      } catch (e) { throw falhaAgenda(e, 'marcar'); } finally { atividade(''); }
    },
  };
  const remarcar = {
    name: 'remarcar_consulta',
    description: 'Troca a consulta já marcada por um novo horário escolhido pela pessoa. Cria o novo antes de apagar o antigo. Devolve {ok, quando, email, convite_por_email, meet_link, documentos_sugeridos}. "novo_inicio" precisa vir das ferramentas.',
    inputSchema: { type: 'object', properties: { novo_inicio: { type: 'string' } }, required: ['novo_inicio'] },
    execute: async (input: Record<string, unknown>) => {
      usadas.push('remarcar_consulta');
      exigeAutomatica();
      const antiga = est.consulta;
      if (!antiga) throw new Error('Não há consulta marcada para remarcar. Se a pessoa quer marcar, use marcar_consulta.');
      if (Date.parse(String(input['novo_inicio'])) === Date.parse(antiga.inicio)) throw new Error('É o mesmo horário já marcado. Pergunte qual novo horário a pessoa prefere.');
      atividade('Ana está remarcando…');
      try {
        const d = { nome: est.dados.nome, email: est.dados.email, assunto: est.dados.assunto };
        const nova = await reservar(String(input['novo_inicio'] ?? ''), d);
        await apagarEvento(mcp!, antiga.id).catch(() => { log('Consulta antiga não foi apagada; conferir na agenda', 'erro'); });
        m.aoApagar?.(antiga.id);
        reservada = nova; remarcou = true;
        est = { ...est, consulta: nova, escolhido: undefined, ultimasOpcoes: [], remarcando: false };
        m.aoReservar?.(nova);
        log(`Consulta remarcada para ${dataHoraCurta(nova.inicio)}`);
        return retornoReserva(nova, d);
      } catch (e) { throw falhaAgenda(e, 'remarcar'); } finally { atividade(''); }
    },
  };
  const cancelar = {
    name: 'cancelar_consulta',
    description: 'Cancela a consulta marcada. Só funciona se você perguntou "quer mesmo cancelar?" na mensagem anterior e a pessoa confirmou agora. Devolve {ok, cancelada}.',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => {
      usadas.push('cancelar_consulta');
      exigeAutomatica();
      const c = est.consulta;
      if (!c) throw new Error('Não há consulta marcada.');
      if (!/cancel/i.test(ultimaAna) || !AFIRMA.test(t)) throw new Error(`Antes de cancelar, pergunte de forma clara: "Quer mesmo cancelar a consulta de ${rotuloCompleto(c.inicio, est.fuso)}?" e espere a confirmação.`);
      atividade('Ana está cancelando…');
      try {
        await apagarEvento(mcp!, c.id);
        m.aoApagar?.(c.id); cancelou = true;
        est = { ...est, consulta: undefined, escolhido: undefined };
        log(`Consulta de ${dataHoraCurta(c.inicio)} cancelada`);
        return { ok: true, cancelada: maiuscula(rotuloCompleto(c.inicio, est.fuso)) };
      } catch (e) { throw falhaAgenda(e, 'cancelar'); } finally { atividade(''); }
    },
  };
  const ferramentas = mcp ? [buscar, doDia, marcar, remarcar, cancelar] : [];

  const perguntar = async (extra?: string) => {
    const turno = `CONTEXTO ATUAL: ${JSON.stringify(contexto())}\n\nMENSAGEM DO CLIENTE: ${t}${extra ? `\n\n${extra}` : ''}`;
    const bruto = await m.sample.json(
      [{ role: 'user', content: INSTRUCOES_ANA }, ...conv.historico, { role: 'user', content: turno }],
      { modelTier: m.nivel, signal: sinal, ...(ferramentas.length ? { tools: ferramentas } : { cache: false }) },
    );
    const lido = respostaSchema.safeParse(bruto);
    if (!lido.success) throw { code: 'invalid_json', message: 'formato' };
    return lido.data;
  };

  atividade('Ana está pensando…');
  const ajustes: string[] = [];
  let r = await perguntar();
  // Nunca mandar mensagem igual ou quase igual a uma anterior: uma nova tentativa, mudando a abordagem.
  const repetida = conv.anaMsgs.find(a => semelhanca(a, r.mensagem) >= 0.8);
  const listouAgenda = usadas.some(u => u === 'buscar_horarios_livres' || u === 'horarios_do_dia');
  // Lista de horários pode voltar depois de outra conversa (ex.: após cancelar), mas nunca igual à mensagem imediatamente anterior.
  if (repetida && r.mensagem.trim() && !reservada && !cancelou && (!listouAgenda || semelhanca(ultimaAna, r.mensagem) >= 0.8)) {
    atividade('Ana está reescrevendo para não se repetir…');
    r = await perguntar(`ATENÇÃO: sua resposta ficou quase igual a uma mensagem que você já mandou ("${repetida.slice(0, 160)}"). Reescreva mudando a abordagem: ofereça opções diretas ou faça uma pergunta de sim ou não.`);
    ajustes.push('Resposta reescrita para não repetir uma mensagem anterior');
    // Ainda repetida: muda a abordagem com uma pergunta direta (opções ou sim/não).
    if (conv.anaMsgs.some(x => semelhanca(x, r.mensagem) >= 0.8) && !reservada && !cancelou) {
      r = { ...r, mensagem: est.ultimasOpcoes.length
        ? 'Algum desses horários serve para você, ou prefere que eu procure outro dia ou período?'
        : est.consulta ? 'Posso te ajudar com mais alguma coisa sobre a sua consulta?' : 'Posso te ajudar a marcar uma consulta ou tirar alguma dúvida?' };
      ajustes.push('Abordagem trocada pela página para não repetir');
    }
  }
  const { horario_escolhido, fuso_cliente, local_cliente, ...base } = r;
  if (fuso_cliente && fusoValido(fuso_cliente) && fuso_cliente !== est.fuso) { est = { ...est, fuso: fuso_cliente, local: local_cliente || est.local }; log(`Fuso do cliente: ${local_cliente || fuso_cliente}`); }
  else if (local_cliente && !est.local) est = { ...est, local: local_cliente };

  // Regras reais da Ana por cima da resposta do Claude.
  let final: AnaResult = aplicarRegrasAna(base, m.modo, t, [], { agendaReal: true, ultimaResposta: ultimaAna, now: agora });
  // Agenda fora do ar: a equipe precisa ficar sabendo (as regras só mantêm o aviso quando o cliente pede uma pessoa).
  if (agendaFalhou) final = { ...final, encaminhar_humano: true, proximo_passo: final.proximo_passo || 'Falha ao acessar a agenda: equipe deve marcar a consulta.' };
  const delicada = final.motivo_aprovacao.startsWith('Questão delicada');
  const perigo = final.mensagem.includes('ligue 190') && !base.mensagem.includes('190');
  if (usadas.length && !delicada && !perigo && final.acao !== 'nenhuma') final = { ...final, mensagem: mascararCpf(base.mensagem) };
  if (citaHorarioDeConsulta(final.mensagem) && !usadas.length && !est.mostrados.length && !est.consulta)
    final = { ...final, acao: 'rascunho', motivo_aprovacao: 'Horário citado sem consultar a agenda real.' };

  // Dados válidos desta mensagem entram antes das garantias.
  const novos = Object.fromEntries(Object.entries(final.dados_coletados).filter(([k, v]) => v && (k !== 'nome' || nomeCompletoValido(v)) && (k !== 'email' || (emailValido(v) && emailDoCliente(v)))));
  est = { ...est, dados: { ...est.dados, ...novos } };
  const escolha = horario_escolhido ? doMostrado(horario_escolhido) : undefined;
  if (escolha && !querMudar && !reservada) est = { ...est, escolhido: escolha };

  // Garantia: horário escolhido + nome completo + e-mail válido ⇒ reserva (ou remarcação), mesmo se o modelo não chamar a ferramenta.
  const urgenciaDePrazo = final.urgente && /audiencia|prazo|citacao|intimacao|oficial de justica|forum/.test(folded);
  if (!reservada && !cancelou && !ocupadoNaReserva && m.modo === 'Automática' && mcp && est.escolhido && !querMudar && !urgenciaDePrazo
      && nomeCompletoValido(est.dados.nome) && emailValido(est.dados.email) && emailDoCliente(est.dados.email) && (!est.consulta || est.remarcando)) {
    const d = { nome: est.dados.nome, email: est.dados.email, assunto: est.dados.assunto };
    try {
      atividade(est.consulta ? 'Ana está remarcando…' : 'Ana está marcando a consulta…');
      const antiga = est.consulta;
      const c = await reservar(est.escolhido, d);
      if (antiga) { await apagarEvento(mcp, antiga.id).catch(() => log('Consulta antiga não foi apagada; conferir na agenda', 'erro')); m.aoApagar?.(antiga.id); remarcou = true; }
      reservada = c;
      est = { ...est, consulta: c, escolhido: undefined, ultimasOpcoes: [], remarcando: false };
      m.aoReservar?.(c);
      log(`${antiga ? 'Consulta remarcada' : 'Consulta criada'} no Google Calendar · ${dataHoraCurta(c.inicio)}`);
      ajustes.push(antiga ? 'Remarcação feita pela página (o modelo não chamou a ferramenta)' : 'Consulta marcada pela página (o modelo não chamou a ferramenta)');
    } catch (e) {
      if (!ocupadoNaReserva) {
        const x = e instanceof ErroAgenda ? e : traduzirErro(e);
        log(`Falha ao marcar: ${x.message}`, 'erro');
        final = { ...final, acao: 'enviar', encaminhar_humano: true, mensagem: 'Não consegui confirmar na agenda agora.\nDeixei seu pedido registrado e a equipe vai te chamar para marcar.' };
        ajustes.push('Falha da agenda tratada pela página');
      }
    } finally { atividade(''); }
  }
  // Horário ocupado na hora da reserva: novas opções reais, nunca "instabilidade".
  if (ocupadoNaReserva && !reservada && mcp) {
    try {
      const opcoes = escolherOpcoes(await horariosLivres(mcp, agora), 3, est.mostrados, 3);
      mostrar(opcoes);
      final = { ...final, acao: 'enviar', encaminhar_humano: false, mensagem: opcoes.length
        ? `Poxa, esse horário acabou de ser preenchido.\nTenho estes livres:\n${linhasOpcoes(opcoes, agora, est.fuso).join('\n')}\nQual fica melhor?`
        : 'Poxa, esse horário acabou de ser preenchido e não achei outro livre nos próximos dias.\nDeixei seu pedido registrado e a equipe vai te chamar para marcar.' };
      ajustes.push('Horário ocupado: novas opções oferecidas pela página');
    } catch { /* mantém a resposta do modelo */ }
  }

  // Confirmação final obrigatória e completa (marcação ou remarcação).
  if (reservada) {
    const ddmm = rotuloCompleto(reservada.inicio, est.fuso).match(/\d{2}\/\d{2}/)?.[0] ?? '';
    const completa = final.mensagem.includes(ddmm) && /remarcar/i.test(final.mensagem) && (final.mensagem.includes('@') || final.mensagem.includes('meet.google.com')) && /deixe à mão|documentos?/i.test(final.mensagem);
    if (!completa) { final = { ...final, acao: 'enviar', mensagem: confirmacaoPadrao(reservada, est.dados.email, est.dados.assunto, m.convite, est.fuso, remarcou) }; ajustes.push('Confirmação completada pela página'); }
  }
  if (cancelou && !/cancelad/i.test(final.mensagem)) { final = { ...final, acao: 'enviar', mensagem: 'Pronto, a consulta foi cancelada.\nSe quiser marcar outro dia, é só me chamar aqui.' }; ajustes.push('Aviso de cancelamento completado pela página'); }

  // Pedidos sobre a consulta já marcada: link e data sempre certos.
  if (est.consulta && !reservada && final.acao === 'enviar') {
    if (/\blink\b|reuniao|\bmeet\b|videochamada/.test(folded) && est.consulta.meet && !final.mensagem.includes('meet.google.com')) { final = { ...final, mensagem: `${final.mensagem}\nO link é este: ${est.consulta.meet}`.trim() }; ajustes.push('Link do Meet incluído pela página'); }
    const ddmm = rotuloCompleto(est.consulta.inicio, est.fuso).match(/\d{2}\/\d{2}/)?.[0] ?? '';
    if (/que dia|qual dia|quando (e|ficou|vai ser|sera)|que horas|data da consulta|horario da consulta|minha consulta/.test(folded) && !final.mensagem.includes(ddmm)) { final = { ...final, mensagem: `${final.mensagem}\nSua consulta é ${rotuloCompleto(est.consulta.inicio, est.fuso)}.`.trim() }; ajustes.push('Data da consulta incluída pela página'); }
  }
  // Cliente atual perguntando do processo: a resposta de acolhimento pode sair (não traz dados do processo).
  if (final.acao === 'rascunho' && final.intencao === 'processo' && m.modo === 'Automática' && /acesso|equipe/i.test(final.mensagem)
      && !/\d{7}|sentenc|andamento (esta|foi)|audiencia (marcada|esta)|juiz/i.test(final.mensagem.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
    final = { ...final, acao: 'enviar', motivo_aprovacao: '' };
    ajustes.push('Resposta de acolhimento sobre processo liberada pela página');
  }
  // Menor de idade: pedir, uma vez, que um responsável participe.
  if (est.menor && !est.avisouMenor && final.acao === 'enviar') {
    if (!/responsave/i.test(final.mensagem)) { final = { ...final, mensagem: `${final.mensagem}\n\nComo você tem menos de 18 anos, peço que um responsável participe da consulta com você, tudo bem?` }; ajustes.push('Pedido de responsável incluído pela página'); }
    est = { ...est, avisouMenor: true };
  }
  // Assunto possivelmente fora de Trabalhista e Cível: oferecer a consulta uma vez, sem dizer se atende.
  const foraDaArea = /divorci|separacao judicial|pensao (alimenticia|do meu filho|da minha filha|dos meus filhos)|guarda (do|da|dos|das) (meu|minha|filh)|criminal|delegacia|fui preso|aposentadori|\binss\b|previdenci|tributari|imposto de renda/.test(folded);
  if (foraDaArea && !est.ofereceuForaDaArea && !est.consulta && final.acao === 'enviar' && !/consulta/i.test(final.mensagem)) {
    final = { ...final, mensagem: `${final.mensagem}\n\nSe quiser, enquanto a equipe verifica, já posso marcar a consulta online com a Dra. Carolina. Quer ver os horários?` };
    ajustes.push('Consulta oferecida pela página (assunto a verificar)');
  }
  if (foraDaArea) est = { ...est, ofereceuForaDaArea: true };
  // Fim de semana: deixar claro que a agenda é de segunda a sexta.
  if (fimDeSemana && final.acao === 'enviar' && !/segunda a sexta/i.test(final.mensagem)) { final = { ...final, mensagem: `A agenda da Dra. Carolina é de segunda a sexta, das 8h às 18h (horário de Brasília).\n${final.mensagem}` }; ajustes.push('Aviso de segunda a sexta incluído pela página'); }
  // Nome com moderação: no máximo uma vez a cada três mensagens.
  const nome = est.primeiroNome || est.dados.nome.split(' ')[0] || '';
  if (nome.length >= 3 && /^[\p{L}]+$/u.test(nome)) {
    const reNome = new RegExp(`(^|[\\s,(])${nome}(?=[\\s!.,?)]|$)`, 'g');
    const usouAntes = conv.anaMsgs.slice(-2).some(a => new RegExp(`\\b${nome}\\b`).test(a));
    let permitidas = usouAntes ? 0 : 1;
    const antes = final.mensagem;
    final = { ...final, mensagem: final.mensagem.replace(new RegExp(`,\\s*${nome}(?=[!.?,])|\\b${nome},\\s*`, 'g'), m0 => (permitidas-- > 0 ? m0 : '')) };
    if (final.mensagem !== antes) { final = { ...final, mensagem: final.mensagem.replace(/^(\s*)([a-zà-ú])/, (_x, e, c) => e + c.toUpperCase()) }; ajustes.push('Nome do cliente usado com moderação'); }
    void reNome;
  }

  const enviou = final.acao === 'enviar' && m.modo === 'Automática' && final.mensagem.trim().length > 0;
  const avisouEquipe = final.encaminhar_humano && !est.equipeAvisada;
  est = { ...est, apresentado: est.apresentado || enviou, equipeAvisada: est.equipeAvisada || final.encaminhar_humano };
  // Vários horários do mesmo dia, um por linha ("amanhã (qui, 29/10) às 8h" / "... às 8h30"): junta numa linha só.
  {
    const linhas = final.mensagem.split('\n');
    // "dia às 8h", "dia às 8h ou 8h30", "dia às 8h, 8h30 ou 11h": mesmo dia → uma linha.
    const reLinha = /^(.*?(?:\)|\d{2}\/\d{2},?)) às ((?:\d{1,2}h\d{0,2})(?:(?:, | ou )\d{1,2}h\d{0,2})*)$/;
    const horasDe = (h: string) => h.split(/, | ou /);
    const saida: string[] = [];
    for (const l of linhas) {
      const m1 = reLinha.exec(l.trim()); const ant = saida.length ? reLinha.exec(saida[saida.length - 1]!.trim()) : null;
      if (m1 && ant && m1[1] === ant[1]) {
        saida.pop();
        const horas = [...horasDe(ant[2]!), ...horasDe(m1[2]!)];
        saida.push(`${m1[1]} às ${horas.slice(0, -1).join(', ')} ou ${horas.at(-1)}`);
      } else saida.push(l);
    }
    if (saida.length !== linhas.length) { final = { ...final, mensagem: saida.join('\n') }; ajustes.push('Horários do mesmo dia agrupados numa linha'); }
  }
  // Até 3 balões; o que passar entra no último (nada é cortado).
  const partes = final.mensagem.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const blocos = enviou ? (partes.length > 3 ? [...partes.slice(0, 2), partes.slice(2).join('\n')] : partes) : [];
  const acaoVista: AnaResult['acao'] = enviou ? 'enviar' : final.acao === 'enviar' ? 'nenhuma' : final.acao;
  for (const a of ajustes) log(a, 'aviso');
  if (avisouEquipe) log('Equipe avisada pela Ana', 'aviso');
  return {
    conversa: {
      estado: est,
      historico: [...conv.historico, { role: 'user' as const, content: `MENSAGEM DO CLIENTE: ${t}` }, { role: 'assistant' as const, content: JSON.stringify({ ...final, horario_escolhido, mensagem: enviou ? final.mensagem : `(não enviada) ${final.mensagem}` }) }].slice(-40),
      anaMsgs: [...conv.anaMsgs, ...(enviou ? [final.mensagem] : [])],
    },
    blocos, avisouEquipe,
    decisao: { acao: acaoVista, intencao: final.intencao, proximo: final.proximo_passo, motivo: final.motivo_aprovacao, urgente: final.urgente, equipe: final.encaminhar_humano, ferramentas: usadas, ajustes, ...(final.acao === 'rascunho' && final.mensagem ? { rascunho: final.mensagem } : {}) },
  };
}
