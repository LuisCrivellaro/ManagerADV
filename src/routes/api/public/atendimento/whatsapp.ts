import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Mensagem } from '@/lib/mock-data';
import { mascararContato } from '@/lib/atendimento/canal-envio';
import { classificarEntrada } from '@/lib/atendimento/intake-rules';
import { chaveTelefone } from '@/lib/atendimento/telefone';
import { numeroWhatsApp } from '@/lib/atendimento/canais/ultramsg';
import { textoEscolhaHorario } from '@/lib/atendimento/botoes-horario';
import { iniciarAtendimentoAutomatico } from '@/lib/atendimento/initial-attendance';
import { decidirEntradaWhatsApp, destinoIgnoradoWhatsApp, mensagemDoSistema } from '@/lib/atendimento/entrada-whatsapp';
import type { Conversa } from '@/lib/mock-data';

function seguroIgual(a: string, b: string) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

const MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const LIMITE = 10 * 1024 * 1024;

const Payload = z.object({
  event_type: z.string().max(60),
  instanceId: z.union([z.string(), z.number()]).optional(),
  data: z.object({
    id: z.string().max(300),
    from: z.string().max(80),
    to: z.string().max(80).optional(),
    body: z.string().max(16000).optional().default(''),
    type: z.string().max(30).optional().default('chat'),
    media: z.string().max(2000).optional(),
    filename: z.string().max(300).optional(),
    fromMe: z.boolean().optional(),
    pushname: z.string().max(200).optional(),
  }).passthrough(),
}).passthrough();

/** Baixa a mídia recebida (limite 10 MB), guarda o original no caso e copia ao Drive se a pasta existir. */
async function guardarMidia(admin: any, url: string, nomeOriginal: string | undefined, tipo: string, caso: { id: string; owner_id: string; dados: unknown }) {
  try {
    if (!/^https:\/\//.test(url)) return undefined;
    const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!r.ok || !r.body) return undefined;
    const mime = ((r.headers.get('content-type') ?? '').split(';')[0] ?? '').trim();
    if (!MIMES.includes(mime)) return undefined;
    const reader = r.body.getReader(); const partes: Uint8Array[] = []; let total = 0;
    for (;;) { const { done, value } = await reader.read(); if (done) break; total += value.length; if (total > LIMITE) { await reader.cancel(); return undefined; } partes.push(value); }
    const bytes = new Uint8Array(total); let o = 0; for (const p of partes) { bytes.set(p, o); o += p.length; }
    const ext = mime === 'application/pdf' ? 'pdf' : mime.split('/')[1];
    const nome = (nomeOriginal || `${tipo}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`).replace(/[\\/]/g, '_').slice(0, 200);
    const path = `${caso.owner_id}/${caso.id}/${crypto.randomUUID()}/${nome}`;
    const up = await admin.storage.from('case-documents').upload(path, bytes, { upsert: false, contentType: mime });
    if (up.error) return undefined;
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    const ws = await admin.from('office_workspace').select('dados').eq('owner_id', caso.owner_id).maybeSingle();
    if (ws.data?.dados) {
      const dados = ws.data.dados as { casos?: Record<string, { arquivos?: unknown[] }> };
      const casos = { ...(dados.casos ?? {}) }; const atual = casos[caso.id] ?? {};
      casos[caso.id] = { ...atual, arquivos: [...(atual.arquivos ?? []), { id: crypto.randomUUID(), nome, path, hash, mime, bytes: total, revisado: false, contrato: false }] };
      await admin.from('office_workspace').update({ dados: { ...dados, casos } }).eq('owner_id', caso.owner_id);
    }
    let driveUrl: string | undefined;
    const pasta = (caso.dados as { pastaDrive?: { id?: string } })?.pastaDrive?.id;
    if (pasta) { try { const { enviarArquivo } = await import('@/lib/atendimento/google-drive.server'); driveUrl = (await enviarArquivo(pasta, nome, mime, bytes)).url; } catch { /* original preservado */ } }
    return { nome, path, driveUrl, imagem: mime.startsWith('image/') };
  } catch { return undefined; }
}

type Admin = Parameters<typeof import('@/lib/atendimento/ana.server').atualizarConversa>[0];
const esperar = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resposta digitada no celular do escritório: registra na conversa e pausa a Ana só ali.
 * Mensagens do próprio sistema (Ana ou envio pelo Manager) também chegam aqui e são reconhecidas pelo texto;
 * como podem chegar antes de serem gravadas, a conferência é repetida uma vez após alguns segundos.
 */
async function registrarRespostaManual(admin: Admin, contato: { conversa_id: string | null; contato_externo: string; status: string } | undefined, data: { id: string; body?: string; type?: string }, auditar: (acao: string, resumo: string, status: string) => unknown) {
  if (!contato || contato.status !== 'liberado' || !contato.conversa_id) return Response.json({ ok: true, ignorado: true });
  const conversaId = contato.conversa_id;
  const msgId = `ultramsg:${contato.contato_externo}:${data.id}`;
  const ler = async () => (await admin.from('casos').select('dados').eq('id', conversaId).maybeSingle()).data?.dados as unknown as Conversa | undefined;
  const texto = data.body ?? '';
  const sistema = (c: Conversa) => (data.type ?? 'chat') === 'chat' && mensagemDoSistema(texto, c);
  let conversa = await ler();
  if (!conversa || conversa.mensagens.some(m => m.id === msgId)) return Response.json({ ok: true, ignorado: true });
  if (sistema(conversa)) return Response.json({ ok: true, sistema: true });
  await esperar(Number(process.env['WHATSAPP_ESPERA_MANUAL_MS'] || 4000));
  conversa = await ler();
  if (!conversa || sistema(conversa)) return Response.json({ ok: true, sistema: true });
  const { atualizarConversa } = await import('@/lib/atendimento/ana.server');
  const agora = new Date();
  const aviso = 'Equipe respondeu pelo celular do escritório; Ana pausada nesta conversa. Use "Retomar Ana" para devolver.';
  await atualizarConversa(admin, conversaId, c => c.mensagens.some(m => m.id === msgId) ? c : {
    ...c,
    mensagens: [...c.mensagens, { id: msgId, de: 'escritorio', texto: texto || '[arquivo enviado pelo celular do escritório]', hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }), dataHora: agora.toISOString(), canal: 'ultramsg', idExterno: data.id, autor: 'Equipe · celular do escritório', status: 'enviada' }],
    agenteAna: { ...c.agenteAna, humano: true, proximoPasso: aviso },
    timeline: [...(c.timeline ?? []), { data: agora.toISOString(), evento: aviso }],
  });
  await auditar('respostaManualWhatsApp', 'Resposta pelo celular do escritório; Ana pausada na conversa', 'sucesso');
  return Response.json({ ok: true, pausada: true });
}

export const Route = createFileRoute('/api/public/atendimento/whatsapp')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env['ULTRAMSG_WEBHOOK_SECRET'];
        if (!secret) return new Response('Não configurado', { status: 503 });
        if (!seguroIgual(new URL(request.url).searchParams.get('s') ?? '', secret)) return new Response('Unauthorized', { status: 401 });

        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ ok: true, ignorado: true });
        const { event_type, instanceId, data } = parsed.data;
        const instancia = (process.env['ULTRAMSG_INSTANCE_ID'] ?? '').replace(/^instance/, '');
        if (instanceId !== undefined && String(instanceId).replace(/^instance/, '') !== instancia) return new Response('Unauthorized', { status: 401 });
        if (destinoIgnoradoWhatsApp(data.from) || (data.to && destinoIgnoradoWhatsApp(data.to))) return Response.json({ ok: true, ignorado: true });
        // Mensagem criada no próprio número do escritório (celular ou envio do sistema): só serve para pausar a Ana.
        const manual = event_type === 'message_create' && data.fromMe === true;
        if (!manual && (event_type !== 'message_received' || data.fromMe)) return Response.json({ ok: true, ignorado: true });

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const auditar = (acao: string, resumo: string, status: string) =>
          supabaseAdmin.rpc('registrar_audit_log', { p_ator: 'canal', p_perfil: 'whatsapp', p_acao: acao, p_resumo: resumo, p_status: status });

        const config = await supabaseAdmin.from('atendimento_canal_config').select('canal_ativo').eq('id', true).maybeSingle();
        if (config.data?.canal_ativo !== 'ultramsg') { await auditar('mensagemRecebida', 'WhatsApp desligado · mensagem ignorada', 'bloqueado'); return Response.json({ ok: true, ignorado: true }); }

        const numero = numeroWhatsApp(manual ? data.to ?? '' : data.from);
        const lerContatos = async () => {
          const lista = await supabaseAdmin.from('atendimento_contatos_teste').select('id,conversa_id,contato_externo,status').eq('canal', 'ultramsg');
          return (lista.data ?? []).find(c => chaveTelefone(c.contato_externo) === chaveTelefone(numero));
        };
        let contato = await lerContatos();
        if (manual) return registrarRespostaManual(supabaseAdmin, contato, data, auditar);

        // Celular próprio do escritório: com a entrada aberta, quem escrever ganha conversa; bloqueados nunca.
        const { donaEntradaWhatsApp, abrirConversaWhatsApp } = await import('@/lib/atendimento/entrada-whatsapp.server');
        const dona = contato?.status === 'liberado' && contato.conversa_id ? {} : await donaEntradaWhatsApp(supabaseAdmin);
        const decisao = decidirEntradaWhatsApp(contato, !!dona.ownerId);
        if (decisao === 'criar' || decisao === 'liberar') {
          try {
            await abrirConversaWhatsApp(supabaseAdmin, dona.ownerId ?? '', numero, data.pushname, contato);
            await auditar('novoContatoWhatsApp', `Nova conversa aberta · ${mascararContato(numero)}`, 'sucesso');
          } catch {
            // Outra mensagem do mesmo número pode ter aberto a conversa ao mesmo tempo: a releitura abaixo decide.
            await auditar('novoContatoWhatsApp', `Conversa não aberta nesta mensagem · ${mascararContato(numero)}`, 'erro');
          }
          contato = await lerContatos();
        }
        if (!contato || contato.status !== 'liberado' || !contato.conversa_id) {
          await auditar('mensagemRecebida', decisao === 'bloqueado' ? `Contato WhatsApp bloqueado · ${mascararContato(numero)}` : `Contato WhatsApp não liberado · ${mascararContato(numero)}${dona.motivo ? ` · ${dona.motivo}` : ''}`, 'bloqueado');
          return Response.json({ ok: true, ignorado: true });
        }
        const caso = await supabaseAdmin.from('casos').select('id,owner_id,dados').eq('id', contato.conversa_id).maybeSingle();
        if (caso.error || !caso.data) return Response.json({ ok: true, ignorado: true });
        const mensagens = (caso.data.dados as unknown as { mensagens?: Mensagem[] }).mensagens ?? [];
        if (mensagens.some(m => m.id === `ultramsg:${contato.contato_externo}:${data.id}`)) {
          const { registrarEmailConversa } = await import('@/lib/atendimento/email.server');
          await registrarEmailConversa(supabaseAdmin, caso.data.id, caso.data.owner_id, `ultramsg:${contato.contato_externo}:${data.id}`);
          return Response.json({ ok: true, repetido: true });
        }

        // Resposta numérica a uma lista de horários vira escolha explícita do horário correspondente.
        let texto = data.body ?? '';
        const atual = caso.data.dados as unknown as { horariosOfertados?: string[]; agenteAna?: { horariosTeste?: string[]; agendaReal?: boolean } };
        const ofertados = atual.agenteAna?.agendaReal && atual.agenteAna.horariosTeste?.length ? atual.agenteAna.horariosTeste : atual.horariosOfertados ?? [];
        const n = /^\s*(\d{1,2})\s*$/.exec(texto)?.[1];
        const escolhido = n ? ofertados[Number(n) - 1] : undefined;
        if (escolhido && Date.parse(escolhido) > Date.now()) texto = textoEscolhaHorario(escolhido);

        const tipo = data.type === 'chat' ? 'texto' : data.type === 'ptt' || data.type === 'audio' ? 'audio' : data.type === 'image' ? 'imagem' : 'arquivo';
        const agora = new Date();
        const nova: Mensagem = {
          id: `ultramsg:${contato.contato_externo}:${data.id}`,
          de: 'cliente',
          texto: tipo === 'texto' ? texto : data.body ?? '',
          arquivo: tipo === 'texto' ? undefined : `[${tipo} recebido pelo WhatsApp]`,
          hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
          dataHora: agora.toISOString(),
          canal: 'ultramsg',
          idExterno: data.id,
        };
        if ((tipo === 'imagem' || tipo === 'arquivo') && data.media) {
          const salvo = await guardarMidia(supabaseAdmin, data.media, data.filename, tipo, caso.data as { id: string; owner_id: string; dados: unknown });
          if (salvo) { nova.arquivo = salvo.nome; nova.path = salvo.path; nova.salvoStart = true; nova.tipo = salvo.imagem ? 'imagem' : 'documento'; nova.driveUrl = salvo.driveUrl; }
          await auditar('anexoRecebido', salvo ? `Anexo WhatsApp guardado${salvo.driveUrl ? ' e copiado ao Google Drive' : ''}` : 'Anexo WhatsApp não pôde ser baixado', salvo ? 'sucesso' : 'erro');
        }
        const { atualizarConversa, processarAna } = await import('@/lib/atendimento/ana.server');
        try {
          await atualizarConversa(supabaseAdmin, caso.data.id, c => c.mensagens.some(m => m.id === nova.id) ? c : classificarEntrada({ ...iniciarAtendimentoAutomatico(c), mensagens: [...c.mensagens, nova] }));
        } catch {
          await auditar('mensagemRecebida', 'Falha ao gravar mensagem WhatsApp', 'erro');
          return Response.json({ error: 'Falha ao registrar' }, { status: 500 });
        }
        await auditar('mensagemRecebida', `WhatsApp ← ${mascararContato(numero)} · ${tipo}`, 'sucesso');
        try {
          const { registrarEmailConversa } = await import('@/lib/atendimento/email.server');
          await registrarEmailConversa(supabaseAdmin, caso.data.id, caso.data.owner_id, nova.id);
        } catch {
          await auditar('emailRecebido', 'Falha ao cadastrar e-mail ou marcar checklist; repetir processamento necessário', 'erro');
          return Response.json({ error: 'Falha ao registrar e-mail' }, { status: 500 });
        }
        if (nova.path) {
          try {
            const { analisarAnexoDoCaso } = await import('@/lib/documentos.server');
            const result = await analisarAnexoDoCaso(supabaseAdmin, caso.data.id, caso.data.owner_id, nova.id);
            await auditar('analisarDocumento', result.ok ? 'Anexo identificado; dados extraídos guardados no atendimento' : result.erro, result.ok ? 'sucesso' : 'erro');
          } catch {
            await atualizarConversa(supabaseAdmin, caso.data.id, c => ({ ...c, mensagens: c.mensagens.map(m => m.id === nova.id ? { ...m, erroAnalise: 'Não foi possível analisar o original. Confira em Documentos.' } : m) }));
            await auditar('analisarDocumento', 'Original preservado; análise pendente', 'erro');
          }
        }
        await processarAna(supabaseAdmin, caso.data.id, nova.id, request);
        return Response.json({ ok: true });
      },
    },
  },
});
