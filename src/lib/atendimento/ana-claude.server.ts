// Ana (Claude) no Atendimento: espera mensagens seguidas, responde, guarda o estado por conversa
// e envia tudo pelo enviarAoCliente. Só servidor.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Conversa as ConversaApp } from '../mock-data';
import { defaultState, type OfficeState } from '../office';
import { newMessage } from '../atendimento';
import { conversaNova, type Conversa as EstadoConversa } from '@/lib/ana-claude/index.server';
import { atualizarConversa } from './ana.server';
import { anaDoProjeto } from './ana-claude-agenda.server';

type Db = SupabaseClient<Database>;
export const ESPERA_MENSAGENS_MS = 4000;
const pausa = (ms: number) => new Promise(r => setTimeout(r, ms));

async function auditar(db: Db, resumo: string, status: 'sucesso' | 'erro' | 'bloqueado', erro?: string) {
  await db.rpc('registrar_audit_log', { p_ator: 'Ana', p_perfil: 'sistema', p_acao: 'agenteAna', p_resumo: resumo.slice(0, 300), p_status: status, ...(erro ? { p_erro: erro.slice(0, 400) } : {}) });
}

/** Mensagens do cliente ainda sem resposta no fim da conversa, na ordem. */
export function pendentesDoCliente(c: Pick<ConversaApp, 'mensagens'>, canal: string) {
  const out: ConversaApp['mensagens'] = [];
  for (let i = c.mensagens.length - 1; i >= 0; i--) {
    const m = c.mensagens[i]!;
    if (m.de !== 'cliente' || m.canal !== canal || m.iaProcessada) break;
    if (m.texto.trim() && !m.arquivo) out.unshift(m);
  }
  return out;
}

export async function processarAnaClaude(db: Db, id: string, messageId: string, canal: string, opcoes: { esperaMs?: number } = {}) {
  await pausa(opcoes.esperaMs ?? ESPERA_MENSAGENS_MS);
  const row = await db.from('casos').select('owner_id,dados,ana_estado').eq('id', id).single();
  if (row.error) return;
  const c = row.data.dados as unknown as ConversaApp;
  // Chegou mensagem nova durante a espera: a chamada dela responde tudo junto.
  if (c.mensagens.at(-1)?.id !== messageId || c.agenteAna?.pausa) return;
  const ws = await db.from('office_workspace').select('dados').eq('owner_id', row.data.owner_id).maybeSingle();
  const state = (ws.data?.dados as unknown as OfficeState) ?? defaultState;
  if (state.anaPausa?.ativa) return;
  const modo = c.modoIA ?? state.automations?.modoIA ?? 'Automática';
  if (modo === 'Desligada') return;

  let ids: string[] = [];
  await atualizarConversa(db, id, atual => {
    ids = [];
    if (atual.mensagens.at(-1)?.id !== messageId) return atual;
    ids = pendentesDoCliente(atual, canal).map(m => m.id);
    return { ...atual, mensagens: atual.mensagens.map(m => ids.includes(m.id) ? { ...m, iaProcessada: true } : m) };
  });
  if (!ids.length) return;
  const texto = c.mensagens.filter(m => ids.includes(m.id)).map(m => m.texto.trim()).join('\n');

  const estadoAnterior = (row.data.ana_estado as unknown as EstadoConversa | null) ?? conversaNova();
  let r;
  try {
    const ana = anaDoProjeto((t, tipo) => { void auditar(db, `Ana · ${t}`, tipo === 'erro' ? 'erro' : 'sucesso'); });
    r = await ana.responder(estadoAnterior, texto, { modo });
  } catch (error) {
    const e = error as { code?: string; message?: string };
    const motivo = `${e.code ?? 'erro'}: ${(e.message ?? 'falha').slice(0, 200)}`;
    await auditar(db, 'Ana não respondeu · conversa marcada para a equipe', 'erro', motivo);
    await atualizarConversa(db, id, x => ({ ...x, agenteAna: { ...x.agenteAna, erro: motivo, proximoPasso: 'Equipe: a Ana não conseguiu responder; atender manualmente.' } }));
    return;
  }

  await db.from('casos').update({ ana_estado: JSON.parse(JSON.stringify(r.conversa)) as Json }).eq('id', id);
  const d = r.decisao;

  if (!r.semResposta && d?.acao !== 'rascunho') {
    const { enviarAoCliente } = await import('./envio.functions');
    for (let i = 0; i < r.blocos.length; i++) {
      const balao = r.blocos[i]!;
      if (i > 0) await pausa(1500);
      try {
        const enviado = await enviarAoCliente(db, id, balao);
        await atualizarConversa(db, id, x => ({ ...x, mensagens: [...x.mensagens, newMessage(balao, { autor: 'ANA', canal, idExterno: enviado.idExterno, respostaAnaDe: messageId, status: enviado.simulado ? 'simulada' : 'enviada' })] }));
      } catch (error) {
        await auditar(db, 'Falha ao enviar resposta da Ana', 'erro', (error as Error).message);
        await atualizarConversa(db, id, x => ({ ...x, agenteAna: { ...x.agenteAna, erro: 'Falha ao enviar resposta da Ana.', proximoPasso: 'Equipe: conferir o envio.' } }));
        break;
      }
    }
  }

  const anterior = estadoAnterior.estado.consulta;
  const consulta = r.conversa.estado.consulta;
  await atualizarConversa(db, id, x => {
    const ana = { ...x.agenteAna, apresentado: true, erro: undefined, ...(d ? { urgente: x.agenteAna?.urgente || d.urgente, proximoPasso: r.avisouEquipe ? 'Equipe avisada pela Ana.' : d.proximo } : {}), ...(r.avisouEquipe ? { motivo: d?.motivo || 'Equipe avisada pela Ana' } : {}) };
    let next: ConversaApp = { ...x, agenteAna: ana };
    if (d?.acao === 'rascunho' && d.rascunho) next = { ...next, iaRetida: d.rascunho, agenteAna: { ...next.agenteAna, motivo: d.motivo || 'Revisão humana' } };
    if (consulta) {
      const fim = new Date(Date.parse(consulta.inicio) + 30 * 60000).toISOString();
      next = { ...next, consultaAgendada: consulta.inicio, agenteAna: { ...next.agenteAna, reservaCalendar: { id: consulta.id, inicio: consulta.inicio, fim, ...(consulta.meet ? { meetUrl: consulta.meet } : {}) } } };
    } else if (anterior && x.agenteAna?.reservaCalendar?.id === anterior.id) {
      next = { ...next, consultaAgendada: undefined, agenteAna: { ...next.agenteAna, reservaCalendar: undefined } };
    }
    return next;
  });
  await auditar(db, `${modo} · ${d?.acao ?? (r.semResposta ? 'sem resposta' : 'enviar')} · ${d?.intencao ?? '-'} · ferramentas: ${d?.ferramentas.join(', ') || 'nenhuma'}${d?.urgente ? ' · urgente' : ''}${r.avisouEquipe ? ' · equipe avisada' : ''}`, 'sucesso');
}
