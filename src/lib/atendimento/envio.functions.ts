import { createServerFn } from '@tanstack/react-start';
import { botoesHorarios } from './botoes-horario';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import {
  configPadrao,
  decidirEnvio,
  mascararContato,
  podeGerenciarCanal,
  resumoEnvio,
  sanitizarConfig,
  validarTextoEnvio,
  type CanalConfig,
  type ContatoTeste,
} from './canal-envio';
import { normalizarTelefone } from './telefone';
import { numeroUltraMsgPermitido } from './production-channel';
import { ultramsgAdapter } from './canais/ultramsg';
import { destinoTelegram, lerDestinoTelegram } from './telegram-bots';

type Db = SupabaseClient<Database>;

interface Ator {
  nome: string;
  perfil: string;
}

async function carregarConfig(supabase: Db): Promise<CanalConfig> {
  const r = await supabase
    .from('atendimento_canal_config')
    .select('canal_ativo,modo_teste,agente_ativo,fonte_sugestoes')
    .eq('id', true)
    .maybeSingle();
  if (r.error) throw new Error('Configuração do canal indisponível.');
  return sanitizarConfig((r.data as CanalConfig | null) ?? configPadrao);
}

async function auditar(
  supabase: Db,
  ator: Ator,
  acao: string,
  resumo: string,
  status: 'sucesso' | 'erro' | 'bloqueado',
  erro?: string,
): Promise<void> {
  await supabase.rpc('registrar_audit_log', {
    p_ator: ator.nome,
    p_perfil: ator.perfil,
    p_acao: acao,
    p_resumo: resumo,
    p_status: status,
    ...(erro ? { p_erro: erro } : {}),
  });
}

async function atorDoUsuario(supabase: Db, userId: string): Promise<Ator> {
  const [perfil, roles] = await Promise.all([
    supabase.from('profiles').select('nome').eq('id', userId).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', userId),
  ]);
  return { nome: perfil.data?.nome ?? 'usuário', perfil: (roles.data ?? []).map((r) => r.role).join(', ') };
}

async function exigirGestor(supabase: Db, userId: string): Promise<Ator> {
  const [senior, admin] = await Promise.all([
    supabase.rpc('has_role', { _user_id: userId, _role: 'advogada_senior' }),
    supabase.rpc('has_role', { _user_id: userId, _role: 'admin' }),
  ]);
  if (!senior.data && !admin.data) throw new Error('Seu perfil não permite esta ação.');
  return atorDoUsuario(supabase, userId);
}

interface EnvioBase {
  conversaId: string;
  acao: string;
  texto: string;
  contatoEsperado?: string;
  /** Horários ofertados viram botões clicáveis no Telegram. */
  horarios?: string[] | undefined;
}

/** Núcleo do envio: vale para mensagens da equipe e do sistema. O destino é sempre buscado no servidor. */
async function enviarComRegras(supabase: Db, ator: Ator, entrada: EnvioBase) {
  const problema = validarTextoEnvio(entrada.texto);
  if (problema) {
    await auditar(supabase, ator, entrada.acao, 'Texto bloqueado antes do envio', 'bloqueado', problema);
    throw new Error(problema);
  }
  const caso = await supabase.from('casos').select('id').eq('id', entrada.conversaId).maybeSingle();
  if (caso.error || !caso.data) throw new Error('Conversa indisponível.');
  const config = await carregarConfig(supabase);

  // Canal desligado: modo demonstração atual, sem chamada externa.
  if (decidirEnvio(config, null).simulado && config.canal_ativo === 'desligado') {
    await auditar(supabase, ator, entrada.acao, `Simulado · ${entrada.texto.length} caracteres`, 'sucesso');
    return { ok: true as const, simulado: true as const, canal: 'simulador' as const };
  }

  if (config.canal_ativo === 'ultramsg') {
    const destino = await supabase.from('atendimento_contatos_teste').select('contato_externo,telefone_ficticio,status').eq('conversa_id',entrada.conversaId).eq('canal','ultramsg').eq('status','liberado').maybeSingle();
    if (destino.error) throw new Error('Destino indisponível ou ambíguo; nada foi enviado.');
    const contato = destino.data;
    if (entrada.contatoEsperado && contato?.contato_externo !== entrada.contatoEsperado) throw new Error('Vínculo do contato alterado; envio interrompido.');
    if (!contato) {
      await auditar(supabase, ator, entrada.acao, 'Envio recusado: contato WhatsApp não liberado', 'bloqueado');
      throw new Error('Contato de WhatsApp não liberado para esta conversa. Nada foi enviado.');
    }
    if (!numeroUltraMsgPermitido(contato.contato_externo)) throw new Error('Número não autorizado nesta fase de produção.');
    if (!process.env['ULTRAMSG_TOKEN'] || !process.env['ULTRAMSG_INSTANCE_ID']) throw new Error('WhatsApp não configurado. Nada foi enviado.');
    const resultado = await ultramsgAdapter.enviarTexto(contato.contato_externo, entrada.texto, entrada.horarios?.length ? { botoes: botoesHorarios(entrada.horarios) } : undefined);
    if (!resultado.ok) {
      await auditar(supabase, ator, entrada.acao, 'Falha no envio pelo WhatsApp', 'erro', resultado.erro);
      throw new Error('O envio pelo WhatsApp não foi concluído. Nada foi registrado como enviado.');
    }
    await auditar(supabase, ator, entrada.acao, resumoEnvio('whatsapp', contato.contato_externo, contato.telefone_ficticio, entrada.texto.length), 'sucesso');
    return { ok: true as const, simulado: false as const, canal: 'ultramsg' as const, idExterno: resultado.idExterno };
  }

  throw new Error('Canal indisponível.');
}

/** Envio pela equipe: exige usuário autenticado do escritório. */
export const enviarMensagemCanal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ conversaId: z.string().uuid(), acao: z.string().min(1).max(60), texto: z.string().max(16000), horarios: z.array(z.string().datetime()).max(8).optional() }))
  .handler(async ({ data, context }) => {
    const ator = await atorDoUsuario(context.supabase, context.userId);
    return enviarComRegras(context.supabase, ator, data);
  });

/** Envio pelo sistema (agente/lembretes): só chamável no servidor, pronto para a fase 3. Ainda não usado. */
export async function enviarMensagemSistema(deps: { supabase: Db; conversaId: string; texto: string; motivo: string; contatoEsperado?:string; horarios?: string[] }) {
  return enviarComRegras(
    deps.supabase,
    { nome: 'agente', perfil: 'sistema' },
    { conversaId: deps.conversaId, acao: `sistema:${deps.motivo}`.slice(0, 60), texto: deps.texto, ...(deps.contatoEsperado?{contatoEsperado:deps.contatoEsperado}:{}), ...(deps.horarios?.length?{horarios:deps.horarios}:{}) },
  );
}

/** Ponto único de envio ao cliente pelo sistema: escolhe o canal ativo (hoje Telegram, depois UltraMsg). */
export async function enviarAoCliente(supabase: Db, conversaId: string, texto: string) {
  return enviarComRegras(supabase, { nome: 'Ana', perfil: 'sistema' }, { conversaId, acao: 'sistema:ana', texto });
}

export const lerConfigCanal = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const config = await carregarConfig(context.supabase);
    return {
      config,
      segredos: {
        telegram: Boolean(process.env['TELEGRAM_BOT_TOKEN']?.trim()),
        webhook: Boolean(process.env['TELEGRAM_WEBHOOK_SECRET']?.trim()),
        telegram2: Boolean(process.env['TELEGRAM_BOT_TOKEN_2']?.trim()),
        webhook2: Boolean(process.env['TELEGRAM_WEBHOOK_SECRET_2']?.trim()),
        ultramsg: Boolean(process.env['ULTRAMSG_TOKEN']?.trim() && process.env['ULTRAMSG_INSTANCE_ID']?.trim()),
      },
    };
  });

export const salvarConfigCanal = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    canal_ativo: z.enum(['desligado', 'ultramsg', 'telegram']),
    fonte_sugestoes: z.enum(['ia_manager', 'agente']),
    agente_ativo: z.boolean().optional(),
  }))
  .handler(async ({ data, context }) => {
    if (data.canal_ativo === 'telegram') throw new Error('Telegram retirado do atendimento.');
    if (data.canal_ativo === 'ultramsg' && (!process.env['ULTRAMSG_TOKEN'] || !process.env['ULTRAMSG_INSTANCE_ID'])) throw new Error('Credenciais do UltraMsg ausentes.');
    const ator = await exigirGestor(context.supabase, context.userId);
    const atual = await carregarConfig(context.supabase);
    const config = sanitizarConfig({...data,agente_ativo:data.agente_ativo??atual.agente_ativo});
    const r = await context.supabase
      .from('atendimento_canal_config')
      .upsert({ id: true, ...config, atualizado_por: context.userId, atualizado_em: new Date().toISOString() });
    if (r.error) throw new Error('Não foi possível salvar a configuração.');
    await auditar(context.supabase, ator, 'salvarConfigCanal', `Canal: ${config.canal_ativo} · sugestões: ${config.fonte_sugestoes}`, 'sucesso');
    return config;
  });

export const listarContatosTeste = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirGestor(context.supabase, context.userId);
    const r = await context.supabase
      .from('atendimento_contatos_teste')
      .select('id,canal,contato_externo,nome,telefone_ficticio,status,conversa_id,criado_em')
      .order('criado_em', { ascending: false });
    if (r.error) throw new Error('Não foi possível carregar os contatos de teste.');
    // chat_id e telefone sempre mascarados na tela
    return (r.data ?? []).map((c) => ({
      ...c,
      bot: lerDestinoTelegram(c.contato_externo).bot,
      contato_externo: mascararContato(c.contato_externo),
      telefone_ficticio: `••••${c.telefone_ficticio.slice(-4)}`,
    }));
  });

export const salvarContatoTeste = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    id: z.string().uuid().optional(),
    bot: z.enum(['principal', 'segundo']).default('principal'),
    canal: z.enum(['ultramsg', 'telegram']).default('ultramsg'),
    contatoExterno: z.string().max(120).optional(),
    nome: z.string().max(120).default(''),
    telefoneFicticio: z.string().max(20),
    status: z.enum(['aguardando_liberacao', 'liberado', 'bloqueado']),
    conversaId: z.string().uuid().nullable().optional(),
  }))
  .handler(async ({ data, context }) => {
    const ator = await exigirGestor(context.supabase, context.userId);
    if (data.canal !== 'ultramsg') throw new Error('Telegram retirado do atendimento.');
    // Na edição, a lista exibe o telefone mascarado: valor com '•' significa "manter o já salvo".
    let telefone = normalizarTelefone(data.telefoneFicticio);
    if (data.id && data.telefoneFicticio.includes('•')) {
      const atual = await context.supabase.from('atendimento_contatos_teste').select('telefone_ficticio').eq('id', data.id).maybeSingle();
      telefone = atual.data?.telefone_ficticio ?? '';
    }
    if (data.status === 'liberado') {
      const atual = data.id ? await context.supabase.from('atendimento_contatos_teste').select('contato_externo,canal').eq('id', data.id).maybeSingle() : undefined;
      const destino = atual?.data?.contato_externo ?? data.contatoExterno ?? '';
      if (atual?.error || (atual?.data && atual.data.canal !== 'ultramsg') || !numeroUltraMsgPermitido(destino)) throw new Error('Número não autorizado nesta fase de produção.');
    }
    if (telefone.length < 12) throw new Error('Informe o telefone fictício com DDD.');
    if (!data.id && !(data.contatoExterno ?? '').trim()) throw new Error(data.canal === 'ultramsg' ? 'Informe o número de WhatsApp.' : 'Informe o chat_id do Telegram.');
    if (data.conversaId) {
      const caso = await context.supabase.from('casos').select('id').eq('id', data.conversaId).maybeSingle();
      if (caso.error || !caso.data) throw new Error('Conversa não encontrada para vincular.');
      const outros = await context.supabase.from('atendimento_contatos_teste').select('id').eq('conversa_id', data.conversaId).eq('canal', data.canal).eq('status', 'liberado');
      if (outros.error) throw new Error('Não foi possível verificar o vínculo.');
      if (data.status === 'liberado' && outros.data?.some(c => c.id !== data.id)) throw new Error('Esta conversa já tem um contato liberado; escolha outra conversa para separar os testes.');
    }
    const registro = {
      canal: data.canal,
      nome: data.nome.trim(),
      telefone_ficticio: telefone,
      status: data.status,
      conversa_id: data.conversaId ?? null,
    };
    const r = data.id
      ? await context.supabase.from('atendimento_contatos_teste').update(registro).eq('id', data.id)
      : await context.supabase.from('atendimento_contatos_teste').insert({
          ...registro,
          contato_externo: data.canal === 'ultramsg' ? normalizarTelefone(data.contatoExterno ?? '') : destinoTelegram(data.bot, (data.contatoExterno ?? '').trim()),
        });
    if (r.error) throw new Error('Não foi possível salvar o contato de teste.');
    await auditar(context.supabase, ator, 'salvarContatoTeste', `${data.nome.trim() || 'contato'} · ${data.status}`, 'sucesso');
    return { ok: true as const };
  });

export const lerAuditLog = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirGestor(context.supabase, context.userId);
    const r = await context.supabase
      .from('audit_log')
      .select('id,ator,perfil,acao,resumo,status,erro,criado_em')
      .order('criado_em', { ascending: false })
      .limit(100);
    if (r.error) throw new Error('Não foi possível carregar o log.');
    return r.data ?? [];
  });

export const registrarAuditoria = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    ator: z.string().max(60),
    perfil: z.string().max(60),
    acao: z.string().max(120),
    resumo: z.string().max(300).default(''),
    status: z.enum(['sucesso', 'erro']),
    erro: z.string().max(300).optional(),
  }))
  .handler(async ({ data, context }) => {
    await auditar(context.supabase, { nome: data.ator, perfil: data.perfil }, data.acao, data.resumo, data.status, data.erro);
    return { ok: true as const };
  });

// Referência mantida para verificação de tipos das regras puras no bundle do servidor.
void podeGerenciarCanal;

/** Registra no UltraMsg o endereço que recebe as mensagens do WhatsApp. Só sênior/admin. */
export const registrarWebhookUltramsg = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ator = await exigirGestor(context.supabase, context.userId);
    const inst = process.env['ULTRAMSG_INSTANCE_ID'], token = process.env['ULTRAMSG_TOKEN'], secret = process.env['ULTRAMSG_WEBHOOK_SECRET'];
    if (!inst || !token || !secret) throw new Error('Credenciais do UltraMsg ausentes.');
    const base = process.env['PUBLIC_APP_URL'] ?? 'https://atendimento-legal-desk.lovable.app';
    const r = await fetch(`https://api.ultramsg.com/${encodeURIComponent(inst)}/instance/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token, webhook_url: `${base}/api/public/atendimento/whatsapp?s=${secret}`, webhook_message_received: 'true', webhook_message_create: 'true', webhook_message_ack: 'false', webhook_message_download_media: 'true' }).toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) {
      await auditar(context.supabase, ator, 'registrarWebhookUltramsg', 'Falha ao registrar webhook', 'erro', `HTTP ${r.status}`);
      throw new Error(`O UltraMsg não confirmou o registro (HTTP ${r.status}).`);
    }
    await auditar(context.supabase, ator, 'registrarWebhookUltramsg', 'Webhook WhatsApp registrado', 'sucesso');
    return { ok: true as const, descricao: 'Recebimento de mensagens do WhatsApp registrado.' };
  });

/** Estado da instância (conectada ao celular ou não). */
export const verificarUltramsg = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirGestor(context.supabase, context.userId);
    const inst = process.env['ULTRAMSG_INSTANCE_ID'], token = process.env['ULTRAMSG_TOKEN'];
    if (!inst || !token) throw new Error('Credenciais do UltraMsg ausentes.');
    const r = await fetch(`https://api.ultramsg.com/${encodeURIComponent(inst)}/instance/status?token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
    const corpo = (await r.json().catch(() => undefined)) as { status?: { accountStatus?: { status?: string; substatus?: string } }; error?: unknown } | undefined;
    if (!r.ok || !corpo?.status) throw new Error(`Não foi possível verificar o WhatsApp (HTTP ${r.status}).`);
    return { status: corpo.status.accountStatus?.status ?? 'desconhecido', substatus: corpo.status.accountStatus?.substatus ?? '' };
  });

/** Legacy calls fail closed; Telegram cannot be reactivated. */
export const registrarWebhookTelegram = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async () => { throw new Error('Telegram retirado do atendimento.'); });
export const verificarTelegram = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async () => ({ registrado: false, pendentes: 0, erro: 'Telegram retirado do atendimento.' }));

/** Entrada do WhatsApp do escritório (celular próprio): lida na área de trabalho de quem abriu. Só sênior/admin. */
export const lerEntradaWhatsApp = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigirGestor(context.supabase, context.userId);
    const ws = await context.supabase.from('office_workspace').select('dados').eq('owner_id', context.userId).maybeSingle();
    if (ws.error) throw new Error('Não foi possível ler a entrada do WhatsApp.');
    const entrada = (ws.data?.dados as { entradaWhatsApp?: { ativa?: boolean; atualizadoEm?: string } } | null)?.entradaWhatsApp;
    return { ativa: entrada?.ativa === true, atualizadoEm: entrada?.atualizadoEm ?? '' };
  });

/** Abre ou fecha a entrada: com ela aberta, quem escrever no WhatsApp do escritório ganha conversa na conta de quem abriu. */
export const salvarEntradaWhatsApp = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ ativa: z.boolean() }))
  .handler(async ({ data, context }) => {
    const ator = await exigirGestor(context.supabase, context.userId);
    if (data.ativa) throw new Error('Entrada geral fechada: atendimento restrito aos números autorizados.');
    const entradaWhatsApp = { ativa: data.ativa, atualizadoEm: new Date().toISOString() };
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const row = await context.supabase.from('office_workspace').select('dados,updated_at').eq('owner_id', context.userId).maybeSingle();
      if (row.error) throw new Error('Não foi possível salvar a entrada do WhatsApp.');
      const dados = { ...((row.data?.dados as Record<string, unknown> | null) ?? {}), entradaWhatsApp };
      const r = row.data
        ? await context.supabase.from('office_workspace').update({ dados: dados as never, updated_at: new Date().toISOString() }).eq('owner_id', context.userId).eq('updated_at', row.data.updated_at).select('owner_id')
        : await context.supabase.from('office_workspace').insert({ owner_id: context.userId, dados: dados as never }).select('owner_id');
      if (r.error) throw new Error('Não foi possível salvar a entrada do WhatsApp.');
      if (r.data?.length) {
        await auditar(context.supabase, ator, 'salvarEntradaWhatsApp', data.ativa ? 'Entrada do WhatsApp aberta: novos contatos atendidos pela Ana' : 'Entrada do WhatsApp fechada: só contatos liberados', 'sucesso');
        return entradaWhatsApp;
      }
    }
    throw new Error('Área de trabalho alterada ao mesmo tempo. Tente de novo.');
  });
