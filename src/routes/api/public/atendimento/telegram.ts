import { createFileRoute } from '@tanstack/react-router';
import { timingSafeEqual } from 'node:crypto';
import { mensagemTelegram } from '@/lib/atendimento/telegram-intake';
import { iniciarAtendimentoAutomatico } from '@/lib/atendimento/initial-attendance';
import { classificarEntrada } from '@/lib/atendimento/intake-rules';
import type { Mensagem } from '@/lib/mock-data';

export const Route = createFileRoute('/api/public/atendimento/telegram')({
  server: {
    handlers: {
      GET: async () => Response.json({ ok: true }),
      POST: async ({ request }) => {
        const secret = process.env['TELEGRAM_WEBHOOK_SECRET'];
        if (!secret) return new Response('Não configurado', { status: 503 });
        const expected = Buffer.from(secret), actual = Buffer.from(request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '');
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return new Response('Unauthorized', { status: 401 });
        const entrada = mensagemTelegram(await request.json().catch(() => null));
        if (!entrada) return Response.json({ ok: true, ignorado: true });
        const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
        const config = await db.from('atendimento_canal_config').select('canal_ativo').eq('id', true).maybeSingle();
        if (config.error) return Response.json({ error: 'Configuração indisponível' }, { status: 500 });
        if (config.data?.canal_ativo !== 'telegram') return Response.json({ ok: true, ignorado: true });
        const contato = await db.from('atendimento_contatos_teste').select('conversa_id,contato_externo').eq('canal', 'telegram').eq('contato_externo', entrada.chatId).eq('status', 'liberado').maybeSingle();
        if (contato.error) return Response.json({ error: 'Contato indisponível' }, { status: 500 });
        if (!contato.data?.conversa_id) return Response.json({ ok: true, ignorado: true });
        const id = contato.data.conversa_id;
        const caso = await db.from('casos').select('owner_id,dados').eq('id', id).maybeSingle();
        if (caso.error) return Response.json({ error: 'Conversa indisponível' }, { status: 500 });
        if (!caso.data) return Response.json({ ok: true, ignorado: true });
        const agora = new Date();
        const nova: Mensagem = { id: `telegram:${entrada.chatId}:${entrada.idExterno}`, de: 'cliente', texto: entrada.texto, arquivo: entrada.arquivo, hora: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }), dataHora: agora.toISOString(), canal: 'telegram', idExterno: entrada.idExterno };
        const { atualizarConversa, processarAna } = await import('@/lib/atendimento/ana.server');
        let inserida = false;
        await atualizarConversa(db, id, c => {
          inserida = !c.mensagens.some(m => m.id === nova.id);
          return inserida ? classificarEntrada({ ...iniciarAtendimentoAutomatico(c), mensagens: [...c.mensagens, nova] }) : c;
        });
        const { registrarEmailConversa } = await import('@/lib/atendimento/email.server');
        await registrarEmailConversa(db, id, caso.data.owner_id, nova.id);
        if (!inserida) return Response.json({ ok: true, repetido: true });
        await db.rpc('registrar_audit_log', { p_ator: 'canal', p_perfil: 'telegram', p_acao: 'mensagemRecebida', p_resumo: 'Mensagem Telegram recebida no contato de teste liberado', p_status: 'sucesso' });
        await processarAna(db, id, nova.id, request);
        return Response.json({ ok: true });
      },
    },
  },
});
