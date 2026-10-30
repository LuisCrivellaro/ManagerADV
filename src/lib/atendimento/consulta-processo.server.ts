import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Conversa } from '../mock-data';
import { newMessage } from '../atendimento';
import { atualizarConversa } from './ana.server';
import { enviarMensagemSistema } from './envio.functions';
import { enviarTextoRevisora } from './canais/ultramsg';
import { pedidoHumano } from './ana-scheduling';
import { criarConsultasProjuris } from '../projuris/consultas.server';
import { identificarClienteProjuris } from '../projuris/indice.server';
import { redigirNoticiaProcesso } from './processo-redacao.server';
import { aplicarDecisao, deveConsultarProcesso, pedidoNoticiaProcesso, iniciarConsultaProcesso, interpretarRespostaRevisora, mensagemNaoCliente, pendencias, proximoCodigo, respostaAutorizada, respostaDuranteEspera, TEXTOS_CONSULTA, type ComandoRevisora, type PedidoProcesso } from './consulta-processo';

type Db = SupabaseClient<Database>;
type Comando = Extract<ComandoRevisora, { acao: 'aprovar' | 'corrigir' | 'recusar' }>;
export async function auditarProcesso(db: Db, evento: string) {
  const r = await db.rpc('registrar_audit_log', { p_ator: 'sistema', p_perfil: 'sistema', p_acao: evento, p_resumo: 'Operação de consulta processual', p_status: 'sucesso' });
  if (r.error) throw new Error('Auditoria processual indisponível.');
}
async function notificarRevisora(texto: string) {
  const r = await enviarTextoRevisora(texto);
  if (!r.ok) throw new Error('Notificação à revisora não confirmada.');
}
async function destino(db: Db, id: string, telefone?: string) {
  const r = await db.from('atendimento_contatos_teste').select('contato_externo').eq('conversa_id', id).eq('canal', 'ultramsg').eq('status', 'liberado').maybeSingle();
  if (r.error || !r.data || telefone && !respostaAutorizada({ canal: 'whatsapp', contato: r.data.contato_externo }, telefone)) throw new Error('Vínculo do cliente alterado; envio bloqueado.');
  return r.data.contato_externo;
}
export async function enviarAvisoProcesso(db: Db, id: string, texto: string, contato: string) {
  const cfg = await db.from('atendimento_canal_config').select('canal_ativo').eq('id', true).maybeSingle();
  if (cfg.error || cfg.data?.canal_ativo !== 'ultramsg' || !contato) throw new Error('Canal ou destino alterado; envio bloqueado.');
  const sent = await enviarMensagemSistema({ supabase: db, conversaId: id, texto, contatoEsperado: contato, motivo: 'consulta_processo' });
  if (sent.simulado) throw new Error('Canal desligado; nada enviado.');
  await atualizarConversa(db, id, c => ({ ...c, agenteAna: { ...c.agenteAna, apresentado: true }, mensagens: [...c.mensagens, newMessage(texto, { autor: 'Ana · assistente virtual', canal: 'ultramsg', idExterno: sent.idExterno, status: 'enviada' })] }));
}
export async function lerPedidosProcesso(db: Db, owner?: string) {
  const query = db.from('casos').select('id,owner_id,dados').order('id');
  if (owner) query.eq('owner_id', owner);
  const rows: { ownerId: string; pedido: PedidoProcesso }[] = [];
  for (let offset = 0; ; offset += 500) {
    const r = await query.range(offset, offset + 499);
    if (r.error) throw new Error('Pedidos indisponíveis.');
    for (const row of r.data ?? []) for (const pedido of (row.dados as unknown as Conversa).agenteAna?.pedidosProcesso ?? []) {
      if (pedido.conversaId === row.id) rows.push({ ownerId: row.owner_id, pedido });
    }
    if ((r.data?.length ?? 0) < 500) return rows;
  }
}
/** Reserva um código no JSON do proprietário por CAS, evitando códigos repetidos entre conversas simultâneas. */
async function reservarCodigo(db: Db, owner: string): Promise<string[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const [ws, pedidos] = await Promise.all([db.from('office_workspace').select('dados,updated_at').eq('owner_id', owner).maybeSingle(), lerPedidosProcesso(db, owner)]);
    if (ws.error) throw new Error('Códigos indisponíveis.');
    const dados = (ws.data?.dados as Record<string, Json> | null) ?? {};
    const reservados = Array.isArray(dados['codigosProcessoReservados']) ? dados['codigosProcessoReservados'].filter((v): v is string => typeof v === 'string') : [];
    const existentes = [...reservados, ...pedidos.map(p => p.pedido.codigo)];
    const codigo = proximoCodigo(existentes);
    const next = { ...dados, codigosProcessoReservados: [...new Set([...existentes, codigo])] };
    const r = ws.data
      ? await db.from('office_workspace').update({ dados: next, updated_at: new Date().toISOString() }).eq('owner_id', owner).eq('updated_at', ws.data.updated_at).select('owner_id')
      : await db.from('office_workspace').insert({ owner_id: owner, dados: next }).select('owner_id');
    if (r.error) throw new Error('Reserva de código indisponível.');
    if (r.data?.length) return existentes;
  }
  throw new Error('Códigos alterados simultaneamente.');
}

/** Mesma sequência de fluxoProcesso do simulador; muda apenas as portas. */
export async function fluxoProcessoReal(db: Db, e: { conversa: Conversa; owner: string; telefone: string; contato: string; texto: string; intencao: string; messageId: string }): Promise<boolean> {
  const c = e.conversa;
  const pendente = c.agenteAna?.pedidosProcesso?.some(p => p.status === 'pendente');
  if (pendente || c.agenteAna?.consultaProcessoEmCurso) {
    const resposta = respostaDuranteEspera(e.texto, e.intencao, true);
    if (!resposta) return false;
    await enviarAvisoProcesso(db, c.id, resposta, e.contato);
    return true;
  }
  if (!deveConsultarProcesso({ texto: e.texto, intencao: e.intencao, encaminharHumano: pedidoHumano(e.texto), aguardandoAssunto: !!c.agenteAna?.aguardandoAssuntoProcesso || !!c.agenteAna?.aguardandoCpfProcesso || c.agenteAna?.vinculoProjuris?.status === 'pendente' && pedidoNoticiaProcesso(e.texto) })) return false;
  let claimed = false;
  await atualizarConversa(db, c.id, current => {
    claimed = false;
    if (current.agenteAna?.consultaProcessoEmCurso || current.agenteAna?.pedidosProcesso?.some(p => p.status === 'pendente') || current.agenteAna?.humano || current.agenteAna?.pausa || current.mensagens.at(-1)?.id !== e.messageId) return current;
    claimed = true;
    return { ...current, agenteAna: { ...current.agenteAna, consultaProcessoEmCurso: { mensagemId: e.messageId, desde: new Date().toISOString() } } };
  });
  if (!claimed) return true;
  try {
    const consultas = criarConsultasProjuris();
    let notificacao = '';
    const result = await iniciarConsultaProcesso({ conversaId: c.id, telefone: e.telefone, nomeContato: c.nome, textoCliente: e.texto, assuntoJaPerguntado: !!c.agenteAna?.aguardandoAssuntoProcesso, vinculo: c.agenteAna?.vinculoProjuris, aguardandoCpf: !!c.agenteAna?.aguardandoCpfProcesso, perguntaOriginal: c.agenteAna?.perguntaProcessoPendente }, {
      agora: () => new Date(), identificar: identificarClienteProjuris,
      processosAtivos: consultas.processosAtivos, ultimosAndamentos: consultas.ultimosAndamentos,
      redigir: redigirNoticiaProcesso, codigosExistentes: () => reservarCodigo(db, e.owner),
      avisarCliente: t => enviarAvisoProcesso(db, c.id, t, e.contato),
      // Persistir antes do envio externo permite receber uma resposta imediata e não perder pedidos em falhas.
      enviarRevisora: async t => { if (!process.env['REVISORA_WHATSAPP']) throw new Error('Revisora ausente.'); notificacao = t; },
      registrar: ev => auditarProcesso(db, ev),
      buscarPorCpf: consultas.pessoasPorCpf,
    });
    await atualizarConversa(db, c.id, current => ({ ...current, agenteAna: { ...current.agenteAna, consultaProcessoEmCurso: undefined, aguardandoAssuntoProcesso: result.tipo === 'perguntar_assunto',
      aguardandoCpfProcesso: result.tipo === 'pedir_cpf',
      perguntaProcessoPendente: result.tipo === 'pedir_cpf' ? (current.agenteAna?.perguntaProcessoPendente ?? e.texto) : result.tipo === 'vinculo_pendente' ? current.agenteAna?.perguntaProcessoPendente : undefined,
      ...(result.tipo === 'vinculo_pendente' ? { vinculoProjuris: result.vinculo, proximoPasso: 'Equipe: confirmar vínculo do cliente no ProJuris.' } : {}),
      ...(result.tipo === 'pedido' && result.vinculo ? { vinculoProjuris: result.vinculo } : {}),
      ...(result.tipo === 'pedido' ? { pedidosProcesso: [...(current.agenteAna?.pedidosProcesso ?? []), result.pedido], proximoPasso: 'Notícia processual aguardando revisão.' } : {}) } }));
    if (result.tipo === 'pedido') {
      try { await notificarRevisora(notificacao); } catch { await auditarProcesso(db, 'notificacao_revisora_pendente'); }
    } else {
      await enviarAvisoProcesso(db, c.id, result.tipo === 'nao_cliente' ? mensagemNaoCliente(new Date()) : result.mensagem, e.contato);
      if (result.tipo !== 'perguntar_assunto' && result.tipo !== 'pedir_cpf' && result.tipo !== 'vinculo_pendente') await atualizarConversa(db, c.id, current => ({ ...current, agenteAna: { ...current.agenteAna, humano: true, proximoPasso: 'Equipe: conferir consulta processual.' } }));
    }
    return true;
  } finally {
    await atualizarConversa(db, c.id, current => ({ ...current, agenteAna: { ...current.agenteAna, consultaProcessoEmCurso: undefined } }));
  }
}

/** Decisão por CAS antes do envio: concorrência/replay nunca envia duas vezes. Falha deixa revisão humana explícita. */
export async function decidirPedidoProcesso(db: Db, id: string, comando: Comando, por: string, canal: 'manager' | 'revisora', hashEsperado?: string) {
  const row = await db.from('casos').select('dados').eq('id', id).single();
  const p = (row.data?.dados as unknown as Conversa | undefined)?.agenteAna?.pedidosProcesso?.find(p => p.codigo === comando.codigo);
  if (row.error || !p || p.conversaId !== id || hashEsperado && p.hash !== hashEsperado) throw new Error('Pedido alterado; atualize a revisão.');
  const contato = comando.acao === 'recusar' ? '' : await destino(db, id, p.contato.telefone);
  const d = await aplicarDecisao(p, comando, por, canal, new Date());
  let claimed = false;
  await atualizarConversa(db, id, c => {
    claimed = false;
    const current = c.agenteAna?.pedidosProcesso?.find(x => x.codigo === p.codigo);
    if (!current || current.status !== 'pendente' || JSON.stringify(current) !== JSON.stringify(p)) return c;
    claimed = true;
    return { ...c, agenteAna: { ...c.agenteAna, pedidosProcesso: c.agenteAna?.pedidosProcesso?.map(x => x.codigo === p.codigo ? d.pedido : x), ...(d.pausarAna ? { humano: true, proximoPasso: 'Equipe: notícia processual recusada pela revisora.' } : {}) } };
  });
  if (!claimed) throw new Error('Pedido já decidido ou alterado; nada enviado.');
  await auditarProcesso(db, `pedido_processo_${d.pedido.status}`);
  if (d.enviarCliente) {
    try { await enviarAvisoProcesso(db, id, d.enviarCliente, contato); }
    catch { await atualizarConversa(db, id, c => ({ ...c, agenteAna: { ...c.agenteAna, humano: true, erro: 'Envio aprovado não confirmado; conferir WhatsApp antes de reenviar.' } })); throw new Error('Decisão salva, mas envio não confirmado. Confira WhatsApp antes de repetir.'); }
  }
  return d.pedido.status;
}

export async function receberRevisora(db: Db, remetente: string, texto: string): Promise<boolean> {
  if (!respostaAutorizada({ canal: 'whatsapp', contato: remetente }, process.env['REVISORA_WHATSAPP'])) return false;
  const itens = (await lerPedidosProcesso(db)).filter(x => x.pedido.status === 'pendente');
  const comando = interpretarRespostaRevisora(texto, itens.map(x => x.pedido.codigo));
  if (comando.acao === 'ambiguo' || comando.acao === 'desconhecido') {
    await notificarRevisora(comando.acao === 'ambiguo' ? comando.motivo : 'Não entendi. Responda "ok CÓDIGO", "corrigir CÓDIGO: texto" ou "não CÓDIGO".');
    return true;
  }
  const alvos = itens.filter(x => x.pedido.codigo === comando.codigo);
  if (alvos.length !== 1) { await notificarRevisora('Código ambíguo entre proprietários; use a revisão no Manager ADV.'); return true; }
  const alvo = alvos[0];
  if (alvo) await decidirPedidoProcesso(db, alvo.pedido.conversaId, comando, 'revisora', 'revisora');
  return true;
}

export async function executarPendenciasProcesso(db: Db, agora = new Date()) {
  let processados = 0;
  for (const { pedido: p } of await lerPedidosProcesso(db)) {
    let lembrete = false; let aviso: string | undefined;
    await atualizarConversa(db, p.conversaId, c => {
      lembrete = false; aviso = undefined;
      const atual = c.agenteAna?.pedidosProcesso?.find(x => x.codigo === p.codigo);
      if (!atual) return c;
      const r = pendencias(atual, agora);
      if (!r.lembrete && !r.avisoCliente) return c;
      lembrete = r.lembrete; aviso = r.avisoCliente;
      return { ...c, agenteAna: { ...c.agenteAna, pedidosProcesso: c.agenteAna?.pedidosProcesso?.map(x => x.codigo !== p.codigo ? x : { ...x, ...(r.lembrete ? { lembretesEm: [...x.lembretesEm, agora.toISOString()] } : {}), ...(r.avisoCliente ? { avisoRetornoEm: agora.toISOString() } : {}) }) } };
    });
    if (!lembrete && !aviso) continue;
    try {
      if (lembrete) await notificarRevisora(`Lembrete: o pedido ${p.codigo} aguarda sua resposta.`);
      if (aviso) await enviarAvisoProcesso(db, p.conversaId, aviso, await destino(db, p.conversaId, p.contato.telefone));
      processados++;
    } catch { await auditarProcesso(db, 'pendencia_processo_envio_nao_confirmado'); }
  }
  return { processados };
}
/** Confirmação do vínculo por CPF (sênior/admin, já verificado na função). Depois a consulta continua no fluxo normal. */
export async function confirmarVinculoProcesso(db: Db, id: string, por: string) {
  const { confirmarVinculo } = await import('../projuris/vinculo');
  let confirmado: import('../projuris/vinculo').VinculoProjuris | undefined;
  await atualizarConversa(db, id, c => {
    confirmado = confirmarVinculo(c.agenteAna?.vinculoProjuris, por, new Date());
    return { ...c, agenteAna: { ...c.agenteAna, vinculoProjuris: confirmado, proximoPasso: 'Vínculo confirmado; consulta de processo liberada.' } };
  });
  await auditarProcesso(db, 'vinculo_cpf_confirmado');
  const row = await db.from('casos').select('owner_id,dados').eq('id', id).single();
  const c = row.data?.dados as unknown as Conversa | undefined;
  const pergunta = c?.agenteAna?.perguntaProcessoPendente;
  if (row.error || !c || !pergunta) return { confirmado: true, consultaRetomada: false };
  const contato = await destino(db, id);
  const ultima = c.mensagens.at(-1)?.id ?? '';
  await atualizarConversa(db, id, x => ({ ...x, agenteAna: { ...x.agenteAna, perguntaProcessoPendente: undefined } }));
  await fluxoProcessoReal(db, { conversa: { ...c, agenteAna: { ...c.agenteAna, perguntaProcessoPendente: undefined } }, owner: row.data.owner_id, telefone: contato, contato, texto: pergunta, intencao: 'consulta_processo', messageId: ultima });
  return { confirmado: true, consultaRetomada: true };
}
