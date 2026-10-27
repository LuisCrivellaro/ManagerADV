import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { canViewOffice } from '@/lib/approval-rules';
import { groupClients, type ClientCase } from '@/lib/clients';
import type { OfficeState } from '@/lib/office';
import type { Conversa } from '@/lib/mock-data';
import { z } from 'zod';
import type { Json } from '@/integrations/supabase/types';

export const readClients = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const roles = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
  if (roles.error) throw new Error('Não foi possível conferir as permissões.');
  const entireOffice = canViewOffice(roles.data.map(r => r.role));
  const client = entireOffice ? (await import('@/integrations/supabase/client.server')).supabaseAdmin : context.supabase;
  const [cases, workspaces, profiles, checklist] = await Promise.all([
    client.from('casos').select('id,owner_id,nome,etapa,dados').order('ordem'),
    client.from('office_workspace').select('owner_id,dados'),
    client.from('profiles').select('id,nome'),
    client.from('checklist_itens').select('caso_id,nome,recebido').order('ordem'),
  ]);
  if (cases.error || workspaces.error || profiles.error || checklist.error) throw new Error('Não foi possível carregar os clientes.');
  const records = cases.data.map<ClientCase>(c => {
    const d = c.dados as unknown as Partial<Conversa> & { rg?: string; numeroPeticao?: string; origem?: string; email?: string; endereco?: string; tituloCaso?: string };
    const workspace = workspaces.data.find(w => w.owner_id === c.owner_id)?.dados as unknown as OfficeState | undefined;
    const saved = workspace?.casos?.[c.id] ?? {};
    return { pipeline:d.etapaPipeline??0,syncs:d.syncs??[],id: c.id, owner: c.owner_id, responsible: profiles.data.find(p => p.id === c.owner_id)?.nome || 'Equipe', mine: c.owner_id === context.userId,
      name: c.nome, cpf: d.cpf ?? '', rg: d.rg ?? '', phone: d.telefone ?? '', stage: c.etapa, attendance: d.atendimento ?? '', petitionNumber: d.numeroPeticao ?? '',
      processes: d.processos ?? [], checklist: checklist.data.filter(i => i.caso_id === c.id).map(i => ({ nome: i.nome, recebido: i.recebido })),
      history: [...(d.timeline ?? []), ...(saved.historico ?? [])], real: d.origem === 'cadastro', email: d.email ?? '', address: d.endereco ?? '', caseTitle: d.tituloCaso ?? '',
      work: { ...saved, peticao: '', memorial: '', fatos: '', fontes: '', versoes: [], arquivos: (saved.arquivos ?? []).map(f => { const { analise: _analysis, ...safe } = f; return safe; }) },
    };
  });
  return { clients: groupClients(records), entireOffice, updatedAt: new Date().toISOString(), projurisConnected: false };
});

export const createClientCase = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({
  name: z.string().trim().min(3).max(160), cpf: z.string().max(20), rg: z.string().max(30), phone: z.string().trim().min(8).max(30), email: z.union([z.string().email(), z.literal('')]), address: z.string().max(500), caseTitle: z.string().trim().min(3).max(200), petitionNumber: z.string().max(100), stage: z.enum(['inicial','documentos','ativo']),
})).handler(async ({ context, data }) => {
  const id = crypto.randomUUID(); const now = new Date();
  const saved = { modoIA: 'Automática', nome: data.name, cpf: data.cpf, rg: data.rg, telefone: data.phone, email: data.email, endereco: data.address, tituloCaso: data.caseTitle, numeroPeticao: data.petitionNumber, origem: 'cadastro', atendimento: `AT-${now.getUTCFullYear()}-${id.slice(0,8).toUpperCase()}`, etapa: data.stage, etapaPipeline: 0, syncs: [], processos: [], documentos: [], mensagens: [], timeline: [{ data: now.toISOString(), evento: `Cadastro de cliente e abertura do caso: ${data.caseTitle}` }] };
  const result = await context.supabase.from('casos').insert({ id, owner_id: context.userId, nome: data.name, etapa: data.stage, dados: saved as unknown as Json });
  if (result.error) throw new Error('Não foi possível salvar o cadastro.');
  return { id };
});

export const addClientHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ caseId: z.string().uuid(), note: z.string().trim().min(3).max(4000) })).handler(async ({ context, data }) => {
  const c = await context.supabase.from('casos').select('dados,updated_at').eq('id', data.caseId).single();
  if (c.error) throw new Error('Somente o responsável pode registrar o histórico deste caso.');
  const saved = c.data.dados as unknown as Partial<Conversa>;
  const result = await context.supabase.from('casos').update({ dados: { ...saved, timeline: [...(saved.timeline ?? []), { data: new Date().toISOString(), evento: data.note }] } as unknown as Json, updated_at: new Date().toISOString() }).eq('id', data.caseId).eq('updated_at', c.data.updated_at).select('id');
  if (result.error || !result.data?.length) throw new Error('O caso foi atualizado por outra pessoa. Atualize e tente novamente.');
  return { ok: true };
});

export const openClientDocument = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator(z.object({ caseId: z.string().uuid(), fileId: z.string().uuid() })).handler(async ({ context, data }) => {
  const roles = await context.supabase.from('user_roles').select('role').eq('user_id', context.userId);
  if (roles.error) throw new Error('Acesso indisponível.');
  const client = canViewOffice(roles.data.map(r => r.role)) ? (await import('@/integrations/supabase/client.server')).supabaseAdmin : context.supabase;
  const c = await client.from('casos').select('owner_id').eq('id', data.caseId).single();
  if (c.error) throw new Error('Documento indisponível.');
  const w = await client.from('office_workspace').select('dados').eq('owner_id', c.data.owner_id).single();
  const state = w.data?.dados as unknown as OfficeState | undefined;
  const file = state?.casos?.[data.caseId]?.arquivos?.find(f => f.id === data.fileId);
  if (w.error || !file || !file.path.startsWith(`${c.data.owner_id}/${data.caseId}/`)) throw new Error('Documento indisponível.');
  const result = await client.storage.from('case-documents').download(file.path);
  if (result.error || !result.data) throw new Error('Não foi possível abrir o documento.');
  // Return bytes, never internal storage hosts or private paths as public links.
  return { name: file.nome, mime: file.mime, base64: btoa(Array.from(new Uint8Array(await result.data.arrayBuffer()), b => String.fromCharCode(b)).join('')) };
});