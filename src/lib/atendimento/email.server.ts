import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Conversa } from '@/lib/mock-data';
import { atualizarConversa } from './ana.server';
import { emailDaMensagem, itemEmail } from './email-rules';

/** Chamador valida sessão/dono ou webhook + remetente liberado antes desta leitura. */
export async function registrarEmailConversa(db: SupabaseClient<Database>, casoId: string, owner: string, mensagemId: string) {
  const row = await db.from('casos').select('dados').eq('id', casoId).eq('owner_id', owner).single();
  if (row.error) throw new Error('Cadastro indisponível neste atendimento.');
  const c = row.data.dados as unknown as Conversa;
  const m = c.mensagens.find(x => x.id === mensagemId);
  const email = m && emailDaMensagem(m);
  if (!email) return { reconhecido: false };
  const itens = await db.from('checklist_itens').select('id,nome,recebido').eq('caso_id', casoId).eq('owner_id', owner);
  if (itens.error) throw new Error('Não foi possível consultar o checklist.');
  const item = itens.data.find(i => itemEmail(i.nome));
  // Verificar antes do cadastro, pois alterações cadastrais podem invalidar aprovação.
  const status = await db.rpc('material_status', { p_case: casoId });
  let pendencia: string | undefined;
  let marcado = item?.recebido === true;
  if (status.error) pendencia = 'E-mail recebido; aprovação indisponível. Checklist preservado para conferência.';
  else if ((status.data as { checklist?: boolean } | null)?.checklist && !marcado) pendencia = 'E-mail recebido; checklist aprovado exige confirmação da equipe para alteração e nova revisão jurídica.';
  await atualizarConversa(db, casoId, x => ({ ...x, email, agenteAna: { ...x.agenteAna, dados: { ...(x.agenteAna?.dados ?? { nome: '', cpf: '', assunto: '', email: '' }), email } } }));
  if (item && !marcado && !pendencia) {
    const write = await db.from('checklist_itens').update({ recebido: true, updated_at: new Date().toISOString() }).eq('id', item.id).eq('caso_id', casoId).eq('owner_id', owner).select('id');
    if (write.error || !write.data?.length) throw new Error('E-mail cadastrado, mas não foi possível marcar o checklist.');
    marcado = true;
  }
  await atualizarConversa(db, casoId, x => ({ ...x,
    mensagens: x.mensagens.map(a => a.id === mensagemId ? { ...a, checklistAtualizado: marcado, pendenciaChecklist: pendencia } : a),
    timeline: x.timeline.some(t => t.evento === `E-mail cadastrado pela mensagem ${mensagemId}`) ? x.timeline : [...x.timeline, { data: new Date().toISOString(), evento: `E-mail cadastrado pela mensagem ${mensagemId}` }],
  }));
  return { reconhecido: true, checklistAtualizado: marcado, pendencia };
}