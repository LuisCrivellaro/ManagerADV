// Ações externas: mensagens do Atendimento passam pelo canal (enviarMensagemCanal);
// as demais seguem simuladas até uma integração real ser conectada.
import { freeSlots } from '@/lib/atendimento';
import { enviarMensagemCanal, registrarAuditoria } from '@/lib/atendimento/envio.functions';

export type N8nAction =
  | "enviarMensagem" | "enviarHorarios" | "solicitarDocumentos" | "gerarContrato"
  | "gerarCobranca" | "agendarRetorno" | "criarPastaCliente" | "iniciarProducao"
  | "buscarJurisprudencia" | "executarAuditoriaIA" | "autuar" | "vincularProcessoProjuris"
  | "sincronizarEtapaProjuris" | "enviarAvisoAndamento" | "enviarListaProvas" | "obterHorariosLivres" | "agendarConsulta" | "iniciarVideochamada" | "solicitarFaltantes" | "enviarAnexo";

export const endpoints: Record<N8nAction, string> = {
  enviarMensagem: "/webhook/whatsapp/enviar",
  enviarHorarios: "/webhook/whatsapp/horarios",
  solicitarDocumentos: "/webhook/whatsapp/documentos-base",
  gerarContrato: "/webhook/projuris/contrato",
  gerarCobranca: "/webhook/mercadopago/cobranca",
  agendarRetorno: "/webhook/agenda/retorno",
  criarPastaCliente: "/webhook/drive/pasta",
  iniciarProducao: "/webhook/producao/iniciar",
  buscarJurisprudencia: "/webhook/jusbrasil/busca",
  executarAuditoriaIA: "/webhook/auditoria/ia",
  autuar: "/webhook/tribunal/autuar",
  vincularProcessoProjuris: "/webhook/projuris/vincular",
  sincronizarEtapaProjuris: "/webhook/projuris/etapa",
  enviarAvisoAndamento: "/webhook/whatsapp/aviso-andamento",
  enviarListaProvas: "/webhook/whatsapp/lista-provas",
  obterHorariosLivres: '/webhook/agenda/horarios-livres',
  agendarConsulta: '/webhook/agenda/consulta',
  iniciarVideochamada: '/webhook/agenda/videochamada',
  solicitarFaltantes: '/webhook/whatsapp/documentos-faltantes',
  enviarAnexo: '/webhook/whatsapp/anexo',
};

let identity = { id: '', nome: '', perfil: '' };
export function setAuditUser(user: typeof identity) { identity = user; }

/** Grava a ação no log de auditoria do banco; nunca envia telefone, chat_id ou texto integral. */
export function recordAudit(action: string, status: 'sucesso' | 'erro', summary = '') {
  if (!identity.id) return;
  void registrarAuditoria({
    data: { ator: identity.nome, perfil: identity.perfil, acao: action, resumo: summary.slice(0, 160), status, erro: status === 'erro' ? summary.slice(0, 160) : undefined },
  }).catch(() => {});
}

async function call<T = { ok: true }>(acao: N8nAction, mock: () => T | Promise<T>): Promise<T> {
  try {
    if (!identity.id) throw new Error('Identidade do usuário ainda não carregada.');
    await new Promise((r) => setTimeout(r, 700 + Math.random() * 600));
    const res = await mock();
    recordAudit(acao, 'sucesso', 'Simulado — nenhum envio real');
    return res;
  } catch (e) {
    recordAudit(acao, 'erro', (e as Error).message);
    throw e;
  }
}

/** Mensagens do Atendimento: enviadas pelo servidor através do canal ativo. */
async function viaCanal(acao: N8nAction, p: { conversaId: string; texto: string; horarios?: string[] }) {
  try {
    const r = await enviarMensagemCanal({ data: { conversaId: p.conversaId, acao, texto: p.texto, ...(p.horarios?.length ? { horarios: p.horarios } : {}) } });
    recordAudit(acao, 'sucesso', r.simulado ? 'Simulado — canal desligado' : 'Enviado pelo canal');
    return r;
  } catch (e) {
    recordAudit(acao, 'erro', (e as Error).message);
    throw e;
  }
}

const ok = () => ({ ok: true as const });
export const n8n = {
  enviarMensagem: (p: { conversaId: string; texto: string }) => viaCanal("enviarMensagem", p),
  enviarHorarios: (p: { conversaId: string; texto: string; horarios?: string[] }) => viaCanal("enviarHorarios", p),
  solicitarDocumentos: (p: { conversaId: string; texto: string }) => viaCanal("solicitarDocumentos", p),
  solicitarFaltantes: (p: { conversaId: string; texto: string }) => viaCanal("solicitarFaltantes", p),
  enviarListaProvas: (p: { conversaId: string; texto: string }) => viaCanal("enviarListaProvas", p),
  gerarContrato: (p: { clienteId: string; documentos?:string[]; texto?:string }) => call("gerarContrato", () => ({ ok: true, link: "https://app.zapsign.com.br/demo" })),
  gerarCobranca: (p: { clienteId: string; valor: number; descricao?:string; vencimento?:string }) => call("gerarCobranca", () => ({ ok: true, link: "https://mpago.la/demo" })),
  agendarRetorno: (p: { clienteId: string; horario: string }) => call("agendarRetorno", ok),
  criarPastaCliente: (p: { clienteId: string }) => call("criarPastaCliente", ok),
  iniciarProducao: (p: { casoId: string }) => call("iniciarProducao", ok),
  buscarJurisprudencia: (p: { termo: string }) => call("buscarJurisprudencia", ok),
  executarAuditoriaIA: (p: { casoId: string }) => call("executarAuditoriaIA", ok),
  autuar: (p: { casoId: string }) => call("autuar", ok),
  vincularProcessoProjuris: (p: { casoId: string; cnj: string }) => call("vincularProcessoProjuris", ok),
  sincronizarEtapaProjuris: (p: { casoId: string; etapa: string }) => call("sincronizarEtapaProjuris", ok),
  enviarAvisoAndamento: (p: { processo: string; texto?:string }) => call("enviarAvisoAndamento", ok),
  obterHorariosLivres: (p:{sextas?:boolean})=>call('obterHorariosLivres',()=>({slots:freeSlots(new Date(),p.sextas)})),
  agendarConsulta:(p:{clienteId:string;horario:string})=>call('agendarConsulta',ok),
  iniciarVideochamada:(p:{clienteId:string})=>call('iniciarVideochamada',()=>({link:`https://meet.google.com/demo-${p.clienteId.slice(0,8)}`})),
  enviarAnexo:(p:{conversaId:string;nome:string})=>call('enviarAnexo',ok),
};
