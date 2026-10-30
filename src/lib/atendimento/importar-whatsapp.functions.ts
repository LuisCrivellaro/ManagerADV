// Importação das conversas já existentes no WhatsApp do escritório (UltraMsg), só leitura e sem a Ana responder.
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Mensagem } from '@/lib/mock-data';

const POR_CLIQUE = 20;
const AVISO = 'Conversa importada do WhatsApp; Ana pausada. Use "Retomar Ana" para ativar.';

interface ChatUltra { id?: string; name?: string; isGroup?: boolean }
interface MsgUltra { id?: string; body?: string; type?: string; timestamp?: number | string; fromMe?: boolean }

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

export const importarConversasWhatsApp = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ inicio: z.number().int().min(0).max(100000) }))
  .handler(async ({ data, context }) => {
    const [senior, admin] = await Promise.all([
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'advogada_senior' }),
      context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' }),
    ]);
    if (!senior.data && !admin.data) throw new Error('Seu perfil não permite esta ação.');
    const instancia = process.env['ULTRAMSG_INSTANCE_ID']?.trim() ?? '';
    const token = process.env['ULTRAMSG_TOKEN']?.trim() ?? '';
    if (!instancia || !token) throw new Error('WhatsApp não configurado.');
    const base = `https://api.ultramsg.com/${encodeURIComponent(instancia)}`;

    const r = await fetch(`${base}/chats?${new URLSearchParams({ token })}`);
    if (!r.ok) throw new Error(`UltraMsg não devolveu as conversas (HTTP ${r.status}).`);
    const lista = (await r.json().catch(() => [])) as ChatUltra[];
    const individuais = (Array.isArray(lista) ? lista : []).filter(c => typeof c.id === 'string' && c.id.endsWith('@c.us') && !c.isGroup);
    const lote = individuais.slice(data.inicio, data.inicio + POR_CLIQUE);

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { abrirConversaWhatsApp } = await import('./entrada-whatsapp.server');
    const { atualizarConversa } = await import('./ana.server');
    const { chaveTelefone } = await import('./telefone');
    const { numeroUltraMsgPermitido } = await import('./production-channel');

    let conversas = 0, mensagens = 0, falhas = 0, mantidas = 0;
    for (let i = 0; i < lote.length; i++) {
      if (i > 0) await esperar(1000);
      const chat = lote[i]!;
      const numero = chat.id!.replace(/@c\.us$/, '').replace(/\D/g, '');
      try {
        if (!numero) throw new Error('Número inválido');
        if (numeroUltraMsgPermitido(numero)) { mantidas++; continue; }
        const lerContato = async () => {
          const l = await supabaseAdmin.from('atendimento_contatos_teste').select('id,conversa_id,contato_externo,status').eq('canal', 'ultramsg');
          if (l.error) throw new Error('Contatos indisponíveis');
          return (l.data ?? []).find(c => chaveTelefone(c.contato_externo) === chaveTelefone(numero));
        };
        let contato = await lerContato();
        if (contato?.status === 'bloqueado') { mantidas++; continue; }
        const rm = await fetch(`${base}/chats/messages?${new URLSearchParams({ token, chatId: chat.id!, limit: '50' })}`);
        if (!rm.ok) throw new Error(`HTTP ${rm.status}`);
        const brutas = (await rm.json().catch(() => [])) as MsgUltra[];
        if (!contato?.conversa_id) {
          await abrirConversaWhatsApp(supabaseAdmin, context.userId, numero, chat.name, contato, true);
          contato = await lerContato();
        }
        if (!contato?.conversa_id) throw new Error('Conversa não aberta');
        const externo = contato.contato_externo;
        const novas: Mensagem[] = (Array.isArray(brutas) ? brutas : []).filter(m => m.id).map(m => {
          const ts = Number(m.timestamp);
          const quando = new Date(Number.isFinite(ts) && ts > 0 ? ts * 1000 : Date.now());
          const t = m.type ?? 'chat';
          const tipo: Mensagem['tipo'] = t === 'chat' ? 'texto' : t === 'image' ? 'imagem' : t === 'ptt' || t === 'audio' ? 'audio' : 'documento';
          const texto = tipo === 'texto' ? (m.body ?? '') : tipo === 'imagem' ? '[imagem]' : tipo === 'audio' ? '[áudio]' : '[documento]';
          return {
            id: `ultramsg:${externo}:${m.id}`, de: m.fromMe ? 'escritorio' : 'cliente', texto, tipo,
            hora: quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
            dataHora: quando.toISOString(), canal: 'ultramsg', idExterno: m.id, iaProcessada: true,
            ...(m.fromMe ? { autor: 'Equipe · importado do WhatsApp', status: 'enviada' as const } : {}),
          };
        });
        let adicionadas = 0;
        await atualizarConversa(supabaseAdmin, contato.conversa_id, c => {
          const ids = new Set(c.mensagens.map(m => m.id));
          const faltam = novas.filter(m => !ids.has(m.id));
          adicionadas = faltam.length;
          const todas = [...c.mensagens, ...faltam].sort((a, b) => Date.parse(a.dataHora ?? '') - Date.parse(b.dataHora ?? ''));
          const jaPausada = c.agenteAna?.humano === true;
          return {
            ...c, mensagens: todas,
            agenteAna: { ...c.agenteAna, humano: true, proximoPasso: jaPausada ? c.agenteAna?.proximoPasso ?? AVISO : AVISO },
            timeline: jaPausada ? c.timeline : [...(c.timeline ?? []), { data: new Date().toISOString(), evento: AVISO }],
          };
        });
        conversas++; mensagens += adicionadas;
      } catch {
        falhas++;
      }
    }
    await context.supabase.rpc('registrar_audit_log', { p_ator: 'equipe', p_perfil: 'gestor', p_acao: 'importarWhatsApp', p_resumo: `Importação do WhatsApp: ${conversas} conversas, ${mensagens} mensagens, ${falhas} falhas`, p_status: falhas ? 'erro' : 'sucesso' });
    const proximo = data.inicio + lote.length;
    return { conversas, mensagens, falhas, mantidas, proximo, total: individuais.length, faltam: proximo < individuais.length };
  });
