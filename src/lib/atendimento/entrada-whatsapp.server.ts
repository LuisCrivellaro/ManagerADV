// Entrada do WhatsApp do escritório no servidor: dono das novas conversas e abertura automática.
// Só é chamado pelo webhook autenticado do UltraMsg, com o cliente privilegiado do servidor.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { normalizarTelefone } from './telefone';
import { novaConversaWhatsApp } from './entrada-whatsapp';

type Db = SupabaseClient<Database>;

/**
 * Dona das conversas novas: a única advogada sênior ou admin que abriu a entrada no Canal e Agente.
 * Nenhuma ou mais de uma ativa: entrada fechada (nada é criado), para não espalhar clientes entre contas.
 */
export async function donaEntradaWhatsApp(db: Db): Promise<{ ownerId?: string; motivo?: string }> {
  const ws = await db.from('office_workspace').select('owner_id,dados').eq('dados->entradaWhatsApp->>ativa', 'true');
  if (ws.error) return { motivo: 'Configuração de entrada indisponível' };
  const donos = [...new Set((ws.data ?? []).map(w => w.owner_id))];
  if (!donos.length) return { motivo: 'Entrada de novos contatos fechada' };
  const papeis = await db.from('user_roles').select('user_id,role').in('user_id', donos);
  if (papeis.error) return { motivo: 'Papéis indisponíveis' };
  const gestores = donos.filter(d => (papeis.data ?? []).some(p => p.user_id === d && (p.role === 'advogada_senior' || p.role === 'admin')));
  if (gestores.length !== 1) return { motivo: gestores.length ? 'Entrada aberta em mais de uma conta' : 'Entrada aberta por perfil sem permissão' };
  const ownerId = gestores[0];
  return ownerId ? { ownerId } : { motivo: 'Entrada de novos contatos fechada' };
}

/** Cria a conversa e libera o contato. Em corrida com outra mensagem do mesmo número, desfaz a conversa vazia criada. */
export async function abrirConversaWhatsApp(db: Db, ownerId: string, numero: string, nomePerfil: string | undefined, existente?: { id: string; conversa_id: string | null }) {
  if (existente?.conversa_id) {
    const r = await db.from('atendimento_contatos_teste').update({ status: 'liberado' }).eq('id', existente.id);
    if (r.error) throw new Error('Não foi possível liberar o contato.');
    return { conversaId: existente.conversa_id, contatoExterno: normalizarTelefone(numero) };
  }
  const id = crypto.randomUUID();
  const nova = novaConversaWhatsApp(id, numero, nomePerfil);
  const caso = await db.from('casos').insert({ id, owner_id: ownerId, nome: nova.nome, etapa: 'inicial', dados: nova.dados as unknown as Json });
  if (caso.error) throw new Error('Não foi possível abrir a conversa.');
  const contatoExterno = normalizarTelefone(numero);
  const registro = existente
    ? await db.from('atendimento_contatos_teste').update({ status: 'liberado', conversa_id: id }).eq('id', existente.id).is('conversa_id', null).select('id')
    : await db.from('atendimento_contatos_teste').insert({ canal: 'ultramsg', contato_externo: contatoExterno, nome: nova.nome, telefone_ficticio: contatoExterno, status: 'liberado', conversa_id: id }).select('id');
  if (registro.error || !registro.data?.length) {
    await db.from('casos').delete().eq('id', id);
    throw new Error('Contato registrado por outra mensagem ao mesmo tempo; conversa duplicada desfeita.');
  }
  return { conversaId: id, contatoExterno };
}
