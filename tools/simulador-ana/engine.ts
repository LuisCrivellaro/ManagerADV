// Simulador da Ana: cópia fiel de processarAna (src/lib/atendimento/ana.server.ts), trocando apenas
// banco, Google Calendar, envio e auditoria por versões em memória. Todas as regras vêm dos módulos reais.
// Nada aqui é usado pelo sistema real.
import type { Conversa } from '@/lib/mock-data';
import { newMessage, chosenSlot, formatarHorarioCliente } from '@/lib/atendimento';
import { escolherReservaAna, idReservaCalendar, intervaloLivre, type ReservaCalendar } from '@/lib/atendimento/calendar-booking';
import { aplicarRegrasAna, expedienteAna, mensagemSemResposta, aceitarRespostaAna, respostaAgendaTeste, priorizarAgendamentoAna, type AnaResult } from '@/lib/atendimento/ana-rules';
import { etiquetaConversa, identificarTipoCliente, classificarEntrada, telefoneAgenda, type TipoCliente } from '@/lib/atendimento/intake-rules';
import { iniciarAtendimentoAutomatico } from '@/lib/atendimento/initial-attendance';
import { horarioPermitido, DURACAO_REUNIAO } from '@/lib/atendimento/schedule-rules';
import { decidirAlteracaoConsulta, decidirCancelamentoAna, operacaoExpirada } from '@/lib/atendimento/appointment-management';
import { solicitarEmailPendente } from '@/lib/atendimento/email-rules';
import { bloqueiaAgenda, pedidoHumano, escolherHorarioAna, pedidoHorarioEspecifico, horarioEspecificoLivre, selecionarOpcoesAna, linhaHorarioAna, listaHorariosAna, pedidoOutrasOpcoesAna, frustracaoHorariosAna, temPreferenciaAna, horizonteAgendaAna, limitarNomeAna } from '@/lib/atendimento/ana-scheduling';

export interface Treino { instrucoes: string; proibidos: string[]; exemplos: { pergunta: string; resposta: string }[] }
export interface EventoAgenda { id: string; inicio: string; fim: string; titulo: string; daAna: boolean; conversa?: string; meetUrl?: string }
export interface Gerado { resultado: AnaResult; bruto: string; modelo?: string | undefined; tier?: string | undefined }
export type Gerador = (contexto: unknown, instrucoes: string, signal?: AbortSignal) => Promise<Gerado>;

/** O que aconteceu em um turno, para o painel de bastidores. */
export interface Turno {
  mensagemId: string;
  textoCliente: string;
  claude?: AnaResult;
  bruto?: string;
  modelo?: string | undefined;
  tier?: string | undefined;
  final?: AnaResult;
  enviada?: string;
  retida?: string;
  semResposta?: string;
  erro?: string;
  eventos: string[];
  contexto?: unknown;
  ms?: number;
}

const CONTATO = '900000001';
const TELEFONE_TESTE = '11999990001';
const CONVERSA_ID = 'simulador-ana';

function conversaInicial(perfil: 'novo' | 'cliente'): Conversa {
  return {
    id: CONVERSA_ID, nome: 'Contato de teste', cpf: '', telefone: TELEFONE_TESTE, atendimento: 'Telegram (simulação)',
    etapa: perfil === 'novo' ? 'inicial' : 'ativo', naoLidas: 0, etapaPipeline: 0, syncs: [], processos: [], documentos: [],
    mensagens: [], timeline: [],
  } as unknown as Conversa;
}

/** Agenda fictícia: ocupa alguns horários dos próximos dias úteis, sempre da mesma forma para a mesma semente. */
export function agendaFicticia(now = new Date(), semente = 7): EventoAgenda[] {
  let s = semente;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const eventos: EventoAgenda[] = [];
  const base = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  for (let d = 0; d < 24; d++) {
    const dia = new Date(base); dia.setDate(base.getDate() + d);
    const wd = dia.getDay();
    if (wd === 0 || wd === 6) continue;
    const data = `${dia.getFullYear()}-${String(dia.getMonth() + 1).padStart(2, '0')}-${String(dia.getDate()).padStart(2, '0')}`;
    // Um a três compromissos por dia; às vezes a manhã inteira ocupada.
    if (rnd() < 0.18) eventos.push({ id: `bloq-${data}-m`, inicio: new Date(`${data}T09:00:00-03:00`).toISOString(), fim: new Date(`${data}T12:00:00-03:00`).toISOString(), titulo: 'Audiência (manhã)', daAna: false });
    const n = 1 + Math.floor(rnd() * 3);
    for (let i = 0; i < n; i++) {
      const slot = Math.floor(rnd() * 16); // 9h às 16h30
      const ini = new Date(`${data}T${String(9 + Math.floor(slot / 2)).padStart(2, '0')}:${slot % 2 ? '30' : '00'}:00-03:00`);
      const dur = rnd() < 0.3 ? 60 : 30;
      eventos.push({ id: `ev-${data}-${i}`, inicio: ini.toISOString(), fim: new Date(ini.getTime() + dur * 60000).toISOString(), titulo: ['Reunião com cliente', 'Prazo interno', 'Retorno de cliente', 'Despacho'][Math.floor(rnd() * 4)] ?? 'Compromisso', daAna: false });
    }
  }
  return eventos.sort((a, b) => a.inicio.localeCompare(b.inicio));
}

export class SimuladorAna {
  conv: Conversa;
  treino: Treino;
  modoIA: 'Automática' | 'Sugerir' | 'Desligada' = 'Automática';
  agenda: EventoAgenda[];
  agendaFalhando = false;
  turnos: Turno[] = [];
  private seq = 0;
  constructor(private gerar: Gerador, treino: Treino, perfil: 'novo' | 'cliente' = 'novo') {
    this.treino = treino;
    this.conv = conversaInicial(perfil);
    this.agenda = agendaFicticia();
  }

  reiniciar(perfil: 'novo' | 'cliente') {
    this.conv = conversaInicial(perfil);
    this.turnos = [];
  }

  devolverParaAna() {
    this.conv = { ...this.conv, agenteAna: { ...this.conv.agenteAna, humano: false, pausa: false, erro: undefined } };
  }

  // ---------- Google Calendar simulado (mesmas validações do google-calendar.server.ts) ----------
  private ocupados(now: Date, dias: number) {
    if (this.agendaFalhando) return null;
    const fim = now.getTime() + dias * 86400000;
    return this.agenda.filter(e => Date.parse(e.fim) > now.getTime() && Date.parse(e.inicio) < fim).map(e => ({ start: e.inicio, end: e.fim }));
  }
  private async reservar(conversaId: string, inicio: string, now: Date, cliente?: { nome: string; telefone: string; tipo: TipoCliente }): Promise<ReservaCalendar> {
    if (!conversaId || !Number.isFinite(Date.parse(inicio)) || Date.parse(inicio) <= now.getTime()) throw new Error('Escolha um horário futuro disponível.');
    if (!cliente?.nome.trim() || !telefoneAgenda(cliente.telefone)) throw new Error('Informe nome e telefone do cliente antes de reservar.');
    if (!horarioPermitido(inicio, cliente.tipo)) throw new Error('Horário fora da carteira de atendimento permitida.');
    if (this.agendaFalhando) throw new Error('Google Calendar respondeu 503 (falha simulada).');
    inicio = new Date(inicio).toISOString();
    const fim = new Date(Date.parse(inicio) + DURACAO_REUNIAO * 60000).toISOString();
    const id = await idReservaCalendar(inicio);
    const existente = this.agenda.find(e => e.id === id);
    if (existente) {
      if (existente.conversa === conversaId && existente.inicio === inicio) return { id, inicio, fim, ...(existente.meetUrl ? { meetUrl: existente.meetUrl } : {}) };
      throw new Error('Compromisso existente não pertence a este atendimento.');
    }
    if (!intervaloLivre(this.agenda.map(e => ({ start: e.inicio, end: e.fim })), inicio, fim)) throw new Error('Esse horário acabou de ficar ocupado. Escolha outro horário.');
    const meetUrl = `https://meet.google.com/sim-${id.slice(3, 7)}-${id.slice(7, 10)}`;
    this.agenda.push({ id, inicio, fim, titulo: `Consulta online · ${cliente.nome}`, daAna: true, conversa: conversaId, meetUrl });
    this.agenda.sort((a, b) => a.inicio.localeCompare(b.inicio));
    return { id, inicio, fim, meetUrl };
  }
  private async cancelar(conversaId: string, reserva: ReservaCalendar, autorizado: boolean) {
    if (!autorizado) throw new Error('Cancelamento exige autorização explícita.');
    if (this.agendaFalhando) throw new Error('Google Calendar respondeu 503 (falha simulada).');
    const ev = this.agenda.find(e => e.id === reserva.id);
    if (!ev) return 'ausente' as const;
    if (ev.conversa !== conversaId || ev.inicio !== new Date(reserva.inicio).toISOString()) throw new Error('Compromisso não pertence a este atendimento.');
    this.agenda = this.agenda.filter(e => e.id !== reserva.id);
    return 'cancelado' as const;
  }
  private async remarcar(conversaId: string, anterior: ReservaCalendar, inicio: string, autorizado: boolean, now: Date, cliente?: { nome: string; telefone: string; tipo: TipoCliente }) {
    if (!autorizado) throw new Error('Remarcação exige autorização explícita.');
    if (this.agendaFalhando) throw new Error('Google Calendar respondeu 503 (falha simulada).');
    const ev = this.agenda.find(e => e.id === anterior.id);
    if (!ev || ev.conversa !== conversaId) throw new Error('Consulta original indisponível para remarcação.');
    if (Date.parse(anterior.inicio) === Date.parse(inicio)) return anterior;
    const nova = await this.reservar(conversaId, inicio, now, cliente);
    try { await this.cancelar(conversaId, anterior, true); }
    catch (error) { await this.cancelar(conversaId, nova, true).catch(() => undefined); throw error; }
    return nova;
  }

  private atualizar(fn: (c: Conversa) => Conversa) { this.conv = fn(this.conv); return this.conv; }

  /** Equivale ao webhook do Telegram + processarAna. */
  async receber(texto: string, signal?: AbortSignal): Promise<Turno> {
    const agora = new Date();
    const id = `telegram:${CONTATO}:${++this.seq}`;
    const nova = { id, de: 'cliente' as const, texto, hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }), dataHora: agora.toISOString(), canal: 'telegram', idExterno: String(this.seq) };
    this.atualizar(c => classificarEntrada({ ...iniciarAtendimentoAutomatico(c), mensagens: [...c.mensagens, nova] }));
    const turno: Turno = { mensagemId: id, textoCliente: texto, eventos: [] };
    this.turnos.push(turno);
    const t0 = performance.now();
    await this.processarAna(id, turno, signal);
    turno.ms = Math.round(performance.now() - t0);
    return turno;
  }

  private async processarAna(messageId: string, turno: Turno, signal?: AbortSignal) {
    const canal = 'telegram' as const;
    const id = CONVERSA_ID;
    const log = (e: string) => turno.eventos.push(e);
    const telefone = TELEFONE_TESTE;
    const c = this.conv;
    const state = { training: this.treino };
    const mode = c.modoIA ?? this.modoIA;
    const m = c.mensagens.find(x => x.id === messageId);
    if (!m || m.iaProcessada) return;
    if (c.agenteAna?.humano || c.agenteAna?.pausa) { turno.semResposta = 'A conversa está com a equipe; a Ana fica em silêncio até ser devolvida.'; return; }
    this.atualizar(cur => ({ ...cur, mensagens: cur.mensagens.map(x => x.id === messageId ? { ...x, iaProcessada: true } : x) }));
    if (mensagemSemResposta(m.texto, !!m.arquivo)) { turno.semResposta = 'Mensagem curta de confirmação ("ok", "obrigado"...): a Ana não responde.'; return; }
    try {
      const history = c.mensagens.filter(x => x.canal === canal).slice(-24).map(x => ({ de: x.de, texto: x.texto, arquivo: x.arquivo ?? '', autor: x.autor ?? '' }));
      const tipoCliente = c.tipoClienteAgenda ?? identificarTipoCliente(m.texto) ?? c.agenteAna?.tipoCliente ?? (c.etapa === 'inicial' ? 'novo' : undefined);
      const etiqueta = etiquetaConversa(c);
      const lista: { nome: string; recebido: boolean }[] = [];
      const email = c.email || c.agenteAna?.dados?.email || '';
      const contexto = { checklist: lista, email_cadastrado: email, solicitar_email: c.etapa === 'documentos' && solicitarEmailPendente(lista as never, email), data_hora_atual: new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), dentro_expediente: expedienteAna(), tipo_cliente_agenda: tipoCliente ?? 'desconhecido; perguntar', area_origem: etiqueta, telefone_informado: telefone ?? '', regras_agenda: '30 minutos; novo segunda a quinta 09:00–17:30; cadastrado sexta 13:30–17:30; sem feriados; sem CPF', modo_ia: mode, vendedor_ativo: false, cliente: c.agenteAna?.dados ?? null, apresentado: c.agenteAna?.apresentado ?? false, consulta_info: c.agenteAna?.reservaCalendar ? { online: true, gratuita: true, duracao_minutos: 30, reserva_confirmada: c.agenteAna.reservaCalendar.inicio } : { online: true, gratuita: true, duracao_minutos: 30 }, horarios_oferecidos: c.agenteAna?.horariosTeste ?? [], temas_proibidos_extra: state.training.proibidos, historico: history, ultima_mensagem: { texto: m.texto, arquivo: m.arquivo ?? '' }, exemplos: state.training.exemplos };
      turno.contexto = contexto;
      const g = await this.gerar(contexto, state.training.instrucoes, signal);
      turno.claude = JSON.parse(JSON.stringify(g.resultado)); turno.bruto = g.bruto; turno.modelo = g.modelo; turno.tier = g.tier;
      const gerada = g.resultado;
      const raw = priorizarAgendamentoAna(gerada, m.texto, c.agenteAna?.resultado?.intencao === 'agendamento' && !c.consultaAgendada);
      raw.dados_coletados.email = email;
      const consentCancel = c.agenteAna?.confirmacaoCancelamento;
      const pendenteCancel = !!consentCancel && consentCancel.eventoId === c.agenteAna?.reservaCalendar?.id && consentCancel.inicio === c.consultaAgendada && consentCancel.contato === telefone && Date.parse(consentCancel.expira) > Date.now();
      const decisaoCancel = decidirCancelamentoAna(m.texto, pendenteCancel);
      const alteracao = decisaoCancel === 'confirmar' ? 'cancelar' : decisaoCancel === 'remarcar' ? 'remarcar' : decisaoCancel === 'pedir' || decisaoCancel === 'manter' ? 'perguntar' : decidirAlteracaoConsulta(m.texto, !!c.consultaAgendada, c.agenteAna?.alteracaoConsulta);
      const semConsulta = decisaoCancel === 'pedir' && !c.consultaAgendada;
      if (decisaoCancel && !pedidoHumano(m.texto)) { raw.intencao = 'agendamento'; raw.encaminhar_humano = false; }
      if (alteracao || c.agenteAna?.alteracaoConsulta === 'remarcar') raw.intencao = 'agendamento';
      const bloqueada = bloqueiaAgenda(m.texto, raw.intencao) || pedidoHumano(m.texto);
      if (!bloqueada && (escolherHorarioAna(c.agenteAna?.horariosTeste ?? [], m.texto) ?? chosenSlot(c.agenteAna?.horariosTeste ?? [], m.texto))) raw.intencao = 'agendamento';
      const teste = true;
      const previous = c.mensagens.filter(x => x.canal === canal && x.de === 'escritorio').at(-1)?.texto ?? '';
      const nome = raw.dados_coletados.nome.trim() || c.agenteAna?.dados?.nome || '';
      let horarios = (c.agenteAna?.horariosTeste ?? []).filter(s => tipoCliente && horarioPermitido(s, tipoCliente) && Date.parse(s) > Date.now());
      let agendaReal = c.agenteAna?.agendaReal === true && horarios.length > 0;
      const oferecidos = c.agenteAna?.horariosTeste ?? [];
      const historicoHorarios = [...new Set([...(c.agenteAna?.horariosApresentados ?? []), ...(c.agenteAna?.agendaReal === true ? oferecidos : []), ...(c.horariosOfertados ?? []), ...(c.consultaAgendada ? [c.consultaAgendada] : [])])];
      const outras = pedidoOutrasOpcoesAna(m.texto) || decisaoCancel === 'remarcar';
      const repetida = (c.agenteAna?.listasHorarios ?? 0) > 0 || historicoHorarios.length > 0;
      const pedidosOutras = (c.agenteAna?.pedidosOutrasOpcoes ?? 0) + (outras && !temPreferenciaAna(m.texto) ? 1 : 0);
      const aceitouPendente = !!c.agenteAna?.horarioPendente && !!c.agenteAna.horarioPendenteDesde && Date.now() - Date.parse(c.agenteAna.horarioPendenteDesde) < 30 * 60000 && /^(?:sim|pode|pode marcar|sim pode|sim por favor|confirmo|confirmar)[.!\s]*$/i.test(m.texto.trim());
      const especifico = !bloqueada ? pedidoHorarioEspecifico(m.texto) : undefined;
      const consultaEspecifica = !!especifico && (/\?|\b(?:tem|livre|disponivel|disponível|pode ser)\b/i.test(m.texto) || !oferecidos.includes(especifico));
      const selecionado = !bloqueada && !consultaEspecifica ? (aceitouPendente ? c.agenteAna?.horarioPendente : escolherHorarioAna(oferecidos, m.texto) ?? chosenSlot([...(c.agenteAna?.horariosTeste ?? []), ...(c.horariosOfertados ?? [])], m.texto)) : undefined;
      if (!bloqueada && (especifico || selecionado || aceitouPendente)) raw.intencao = 'agendamento';
      const gerenciarExistente = !!c.consultaAgendada && alteracao !== 'remarcar' && c.agenteAna?.alteracaoConsulta !== 'remarcar';
      let horarioPendente: string | undefined;
      let semPeriodo = false;
      let indisponivel = false;
      if (teste && tipoCliente && telefone && raw.intencao === 'agendamento' && !bloqueada && !selecionado && !gerenciarExistente && !semConsulta && (nome || consultaEspecifica || /horarios|horários/.test(m.texto))) {
        const busy = this.ocupados(new Date(), horizonteAgendaAna());
        if (!busy) throw new Error('Agenda indisponível; nenhum horário oferecido.');
        log('Servidor consultou a agenda (disponibilidade atual).');
        agendaReal = true;
        if (consultaEspecifica && especifico && horarioEspecificoLivre(especifico, busy, tipoCliente)) {
          horarioPendente = especifico; horarios = [especifico];
        } else {
          indisponivel = consultaEspecifica;
          const opcoes = selecionarOpcoesAna(busy, new Date(), tipoCliente, m.texto, historicoHorarios, true);
          horarios = opcoes.slots; semPeriodo = opcoes.semPeriodo;
        }
      }
      const r = aplicarRegrasAna(raw, mode, m.texto, state.training.proibidos, { teste, horarios, ultimaResposta: previous, agendaReal, tipoCliente, nome, telefone, emailPendente: c.etapa === 'documentos' && solicitarEmailPendente(lista as never, email) });
      if (agendaReal && !selecionado && !horarioPendente && !gerenciarExistente && r.acao === 'enviar' && r.intencao === 'agendamento' && !r.motivo_aprovacao) {
        r.mensagem = listaHorariosAna(horarios, new Date(), repetida);
        if (frustracaoHorariosAna(m.texto) && horarios.length) r.mensagem = r.mensagem.replace(/^[^\n]+/, 'Desculpe! Aqui vão opções diferentes:');
        if (outras && pedidosOutras >= 2 && !temPreferenciaAna(m.texto) && horarios.length) r.mensagem = r.mensagem.replace('Qual fica melhor para você? Se preferir, me diga outro dia ou horário.', 'Prefere algum dia da semana ou período, manhã ou tarde?');
      }
      if (horarioPendente && mode === 'Automática' && !r.encaminhar_humano && !r.motivo_aprovacao) { r.acao = 'enviar'; r.mensagem = `${linhaHorarioAna(horarioPendente)} está livre. Posso marcar para você?`; r.proximo_passo = 'Aguardar aceite explícito e nome completo para reservar o horário consultado.'; }
      if (indisponivel && r.acao === 'enviar') r.mensagem = `Esse horário não está disponível.\n\n${r.mensagem}`;
      if (semPeriodo && r.acao === 'enviar') r.mensagem = 'Não encontrei novas opções livres nesse período nos próximos 15 dias úteis. Quer que a equipe entre em contato com você?';
      const gerenciar = teste && mode === 'Automática' && !r.encaminhar_humano && !r.motivo_aprovacao && !!c.consultaAgendada;
      const cancelar = gerenciar && decisaoCancel === 'confirmar' && pendenteCancel;
      const perguntar = gerenciar && !cancelar && alteracao !== 'remarcar' && c.agenteAna?.alteracaoConsulta !== 'remarcar' && r.intencao === 'agendamento';
      if (perguntar) { r.mensagem = `Você já tem uma consulta marcada para ${formatarHorarioCliente(c.consultaAgendada ?? '')}. Deseja remarcar ou cancelar esse agendamento?`; r.proximo_passo = 'Aguardar autorização do cliente para cancelar ou remarcar.'; }
      if (gerenciar && decisaoCancel === 'pedir') { r.mensagem = `Quer mesmo cancelar a sua consulta de ${formatarHorarioCliente(c.consultaAgendada ?? '').toLowerCase()}? Se preferir, posso remarcar para outro dia.`; r.proximo_passo = 'Aguardar confirmação explícita posterior para cancelar esta consulta.'; }
      if (gerenciar && decisaoCancel === 'manter') { r.mensagem = `Combinado, sua consulta continua marcada para ${formatarHorarioCliente(c.consultaAgendada ?? '').toLowerCase()}.`; r.proximo_passo = 'Consulta mantida por escolha do cliente.'; }
      if (semConsulta && mode === 'Automática' && !pedidoHumano(m.texto)) { r.acao = 'enviar'; r.motivo_aprovacao = ''; r.encaminhar_humano = false; r.mensagem = 'Não encontrei consulta marcada por aqui. Quer marcar uma?'; r.proximo_passo = 'Aguardar interesse em novo agendamento.'; }
      if (cancelar) { r.mensagem = ''; r.proximo_passo = 'Cancelar consulta somente após validar o recibo do atendimento.'; }
      const agenda = !horarioPendente && !bloqueada && !perguntar && !cancelar && !semConsulta && teste && tipoCliente && telefone && r.intencao === 'agendamento' && r.acao === 'enviar' ? respostaAgendaTeste(m.texto, horarios, new Date(), agendaReal, tipoCliente, repetida) : undefined;
      let accepted = false;
      this.atualizar(current => {
        accepted = false;
        if (!aceitarRespostaAna(messageId, current.mensagens.at(-1)?.id, current.agenteAna)) return current;
        accepted = true;
        return { ...current, ...(current.etiquetaAcao || etiqueta === 'sem' ? {} : { etiquetaAcao: etiqueta }), agenteAna: { ...current.agenteAna, ...(gerenciar && alteracao === 'remarcar' && current.agenteAna?.reservaCalendar ? { alteracaoConsulta: 'remarcar' as const, autorizacaoRemarcacao: { eventoId: current.agenteAna.reservaCalendar.id, inicio: current.agenteAna.reservaCalendar.inicio, contato: telefone, expira: new Date(Date.now() + 30 * 60000).toISOString() } } : {}), tipoCliente, telefone, horarioPendente: horarioPendente ?? (aceitouPendente ? c.agenteAna?.horarioPendente : undefined), horarioPendenteDesde: horarioPendente ? new Date().toISOString() : aceitouPendente ? c.agenteAna?.horarioPendenteDesde : undefined, ...(horarioPendente ? { horariosTeste: [horarioPendente], agendaReal: true } : {}), ...(agenda && agendaReal ? { horariosTeste: agenda.slots, agendaReal } : {}), resultado: r, dados: { ...(current.agenteAna?.dados ?? { nome: '', cpf: '', assunto: '', email: '' }), ...Object.fromEntries(Object.entries(r.dados_coletados).filter(([, v]) => v)) }, humano: r.encaminhar_humano, urgente: r.urgente || current.agenteAna?.urgente || false, motivo: r.motivo_aprovacao, proximoPasso: r.proximo_passo, erro: undefined }, iaRetida: r.acao === 'rascunho' ? r.mensagem : current.iaRetida } as Conversa;
      });
      if (!accepted) return;
      if (decisaoCancel === 'manter' || decisaoCancel === 'remarcar') this.atualizar(x => ({ ...x, agenteAna: { ...x.agenteAna, confirmacaoCancelamento: undefined, ...(decisaoCancel === 'manter' ? { alteracaoConsulta: undefined, autorizacaoRemarcacao: undefined, horarioPendente: undefined, horarioPendenteDesde: undefined } : {}) } }));
      if (r.acao === 'enviar' && (r.mensagem.trim() || cancelar)) {
        const current = this.conv;
        let escolhido: string | undefined;
        if (cancelar) {
          try {
            const reserva = current.agenteAna?.reservaCalendar;
            if (!reserva || reserva.inicio !== current.consultaAgendada) throw new Error('Consulta sem recibo verificável; equipe deve conferir antes de cancelar.');
            const consent = current.agenteAna?.confirmacaoCancelamento;
            if (!consent || consent.eventoId !== reserva.id || consent.inicio !== reserva.inicio || consent.contato !== telefone || Date.parse(consent.expira) <= Date.now()) throw new Error('Confirmação de cancelamento inválida ou vencida.');
            if (current.agenteAna?.operacaoConsulta && !operacaoExpirada(current.agenteAna.operacaoConsulta)) throw new Error('Alteração já em andamento.');
            const resultado = await this.cancelar(id, reserva, true);
            log(resultado === 'ausente' ? 'Agenda: compromisso já não existia (ausente).' : 'Agenda: compromisso CANCELADO (convidados notificados).');
            r.mensagem = `Pronto, sua consulta de ${formatarHorarioCliente(reserva.inicio).toLowerCase()} foi cancelada. Se quiser marcar outro dia, é só me chamar.`;
            r.proximo_passo = resultado === 'ausente' ? 'Consulta retirada do atendimento; o compromisso já não estava na agenda conectada. Equipe: conferir outras agendas.' : 'Consulta cancelada com autorização do cliente.';
            this.atualizar(x => ({ ...x, consultaAgendada: undefined, horariosOfertados: [], agenteAna: { ...x.agenteAna, confirmacaoCancelamento: undefined, operacaoConsulta: undefined, reservaCalendar: undefined, alteracaoConsulta: undefined, autorizacaoRemarcacao: undefined, horarioPendente: undefined, horarioPendenteDesde: undefined, horariosTeste: [], agendaReal: false, resultado: r, proximoPasso: r.proximo_passo } }));
          } catch (error) {
            log(`Falha ao cancelar: ${(error as Error).message}`);
            r.mensagem = 'Não consegui cancelar agora. Deixei registrado e a equipe vai confirmar com você.'; r.encaminhar_humano = true; r.proximo_passo = 'Equipe: conferir falha de cancelamento; consulta não confirmada como cancelada.';
            this.atualizar(x => ({ ...x, agenteAna: { ...x.agenteAna, operacaoConsulta: undefined, humano: true, resultado: r, erro: 'Falha ao cancelar; conferir agenda.', proximoPasso: r.proximo_passo } }));
          }
        }
        const ofertasEquipe = (current.horariosOfertados ?? []).filter(s => tipoCliente && horarioPermitido(s, tipoCliente) && Date.parse(s) > Date.now());
        escolhido = escolherReservaAna({ texto: m.texto, selecionado, horarios: agendaReal ? [...(c.agenteAna?.horariosTeste ?? []), ...ofertasEquipe] : ofertasEquipe, real: agendaReal || ofertasEquipe.length > 0, tipoCliente, teste: true, modo: current.modoIA ?? this.modoIA, bloqueado: bloqueada || consultaEspecifica || cancelar || perguntar || !tipoCliente || !nome || !telefone || r.intencao !== 'agendamento' || r.encaminhar_humano || !!r.motivo_aprovacao });
        if (escolhido) {
          if (current.consultaAgendada && current.agenteAna?.alteracaoConsulta !== 'remarcar') {
            r.mensagem = `Você já tem uma consulta marcada para ${formatarHorarioCliente(current.consultaAgendada)}. Deseja remarcar ou cancelar esse agendamento?`;
            r.proximo_passo = 'Aguardar autorização para alteração da consulta.';
          } else {
            try {
              const cliente = { nome, telefone: telefone ?? '', tipo: tipoCliente ?? 'novo' as TipoCliente };
              if (current.consultaAgendada) {
                const consent = current.agenteAna?.autorizacaoRemarcacao;
                if (!current.agenteAna?.reservaCalendar || !consent || consent.eventoId !== current.agenteAna.reservaCalendar.id || consent.inicio !== current.consultaAgendada || consent.contato !== telefone || Date.parse(consent.expira) <= Date.now()) throw new Error('Remarcação sem autorização vigente para esta consulta.');
              }
              const reserva = current.consultaAgendada && current.agenteAna?.reservaCalendar ? await this.remarcar(id, current.agenteAna.reservaCalendar, escolhido, true, new Date(), cliente) : await this.reservar(id, escolhido, new Date(), cliente);
              log(current.consultaAgendada ? 'Agenda: REMARCADA (novo criado antes de excluir o antigo).' : 'Agenda: consulta RESERVADA com Meet (link simulado).');
              r.mensagem = `Sua consulta está confirmada para ${formatarHorarioCliente(reserva.inicio)}.${reserva.meetUrl ? `\nAcesse a reunião: ${reserva.meetUrl}` : ''}`;
              r.proximo_passo = 'Consulta reservada automaticamente no Google Calendar.';
              this.atualizar(x => ({ ...x, consultaAgendada: reserva.inicio, horariosOfertados: [], agenteAna: { ...x.agenteAna, operacaoConsulta: undefined, reservaCalendar: reserva, alteracaoConsulta: undefined, autorizacaoRemarcacao: undefined, horariosTeste: [], horarioPendente: undefined, horarioPendenteDesde: undefined, consultaTeste: undefined, resultado: r, proximoPasso: r.proximo_passo } }));
            } catch (error) {
              log(`Falha na reserva: ${(error as Error).message}`);
              r.mensagem = 'Não consegui concluir a reserva na agenda. Deixei a situação registrada para a equipe verificar; não considere o horário confirmado por esta mensagem.';
              r.proximo_passo = 'Equipe: conferir a agenda e a falha de reserva antes de retomar.';
              this.atualizar(x => ({ ...x, agenteAna: { ...x.agenteAna, humano: true, erro: 'Falha ao concluir a reserva; conferir Google Calendar.', resultado: { ...r, encaminhar_humano: true }, proximoPasso: r.proximo_passo } }));
            }
          }
        } else if (!cancelar && !perguntar && agendaReal && agenda?.selected) {
          r.mensagem = 'Não posso reservar esse horário agora. Peça novos horários disponíveis para continuar.';
          r.proximo_passo = 'Consultar novos horários disponíveis.';
        }
        r.mensagem = limitarNomeAna(r.mensagem, nome, c.mensagens.filter(x => x.canal === canal && x.de === 'escritorio').slice(-2).map(x => x.texto));
        const novosOferecidos = !escolhido && !cancelar && !perguntar && !semConsulta && agendaReal && !agenda?.selected ? (horarioPendente ? [horarioPendente] : agenda?.slots ?? []) : [];
        turno.enviada = r.mensagem;
        this.atualizar(cur => ({ ...cur, iaRetida: undefined, agenteAna: { ...cur.agenteAna, apresentado: true, ...(gerenciar && decisaoCancel === 'pedir' && cur.agenteAna?.reservaCalendar?.id === c.agenteAna?.reservaCalendar?.id && cur.agenteAna?.reservaCalendar ? { confirmacaoCancelamento: { eventoId: cur.agenteAna.reservaCalendar.id, inicio: cur.agenteAna.reservaCalendar.inicio, contato: telefone, expira: new Date(Date.now() + 30 * 60000).toISOString() } } : {}), ...(novosOferecidos.length ? { horariosApresentados: [...new Set([...(cur.agenteAna?.horariosApresentados ?? []), ...historicoHorarios, ...novosOferecidos])], listasHorarios: (cur.agenteAna?.listasHorarios ?? 0) + 1, pedidosOutrasOpcoes: pedidosOutras } : {}) }, mensagens: [...cur.mensagens, newMessage(r.mensagem, { autor: 'Ana · assistente virtual', canal, idExterno: `sim-${this.seq}`, respostaAnaDe: messageId, status: 'enviada' })] }));
      } else if (r.acao === 'rascunho') {
        turno.retida = r.mensagem;
      } else {
        turno.semResposta = mode === 'Desligada' ? 'IA desligada nesta conversa.' : 'A Ana decidiu não responder (ação "nenhuma").';
      }
      turno.final = r;
      if (r.encaminhar_humano) log('Conversa passada para a equipe: a Ana fica pausada até ser devolvida.');
      if (r.urgente) log('Marcada como URGENTE para a equipe.');
    } catch (error) {
      const msg = (error as { code?: string; message?: string }).message ?? String(error);
      turno.erro = msg;
      this.atualizar(cur => ({ ...cur, agenteAna: { ...cur.agenteAna, humano: true, erro: msg, operacaoConsulta: undefined, proximoPasso: 'Equipe: conferir falha da Ana antes de retomar.' } }));
      log('Falha: atendimento encaminhado para a equipe (no sistema real a Ana para nesta conversa).');
    }
  }
}
