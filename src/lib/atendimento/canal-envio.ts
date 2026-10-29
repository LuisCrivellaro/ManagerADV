// Regras puras do envio por canal: validação de texto, decisão de destino e permissões.
import { mensagemPermitida } from '../atendimento';
import { mascararTelefone } from './telefone';

export type CanalAtivo = 'desligado' | 'telegram' | 'ultramsg';
export type FonteSugestoes = 'ia_manager' | 'agente';

export interface CanalConfig {
  canal_ativo: CanalAtivo;
  modo_teste: boolean;
  agente_ativo: boolean;
  fonte_sugestoes: FonteSugestoes;
}

/** Tudo fica DESLIGADO por padrão. */
export const configPadrao: CanalConfig = {
  canal_ativo: 'desligado',
  modo_teste: true,
  agente_ativo: false,
  fonte_sugestoes: 'ia_manager',
};

export interface ContatoTeste {
  canal: string;
  contato_externo: string;
  nome: string;
  telefone_ficticio: string;
  status: 'aguardando_liberacao' | 'liberado' | 'bloqueado';
  conversa_id: string | null;
}

/** Bloqueia texto vazio, campos {entre_chaves} não preenchidos e "Link não registrado". */
export function validarTextoEnvio(texto: string): string | null {
  if (!texto.trim()) return 'A mensagem está vazia.';
  if (/\{[^{}\n]{1,40}\}/.test(texto)) return 'Preencha todos os campos entre chaves antes de enviar.';
  if (!mensagemPermitida(texto)) return 'Registre o link do contrato antes de enviar.';
  return null;
}

export interface DecisaoEnvio {
  permitido: boolean;
  /** true quando nada sai do sistema (modo demonstração atual). */
  simulado: boolean;
  motivo?: string;
}

/** Decide para onde vai a mensagem. Com canal desligado nenhuma chamada externa acontece. */
export function decidirEnvio(config: CanalConfig, contato: Pick<ContatoTeste, 'status'> | null): DecisaoEnvio {
  if (config.canal_ativo === 'desligado') return { permitido: true, simulado: true };
  if (config.canal_ativo === 'telegram') return { permitido: false, simulado: false, motivo: 'Telegram retirado do atendimento.' };
  if (config.canal_ativo === 'ultramsg') {
    if (!contato || contato.status !== 'liberado') {
      return { permitido: false, simulado: false, motivo: 'Modo teste: contato não liberado. Nada foi enviado.' };
    }
    return { permitido: true, simulado: false };
  }
  return { permitido: false, simulado: true, motivo: 'Canal indisponível.' };
}

/** Só advogada sênior ou administrador alteram a configuração do canal. */
export function podeGerenciarCanal(roles: string[]): boolean {
  return roles.includes('advogada_senior') || roles.includes('admin');
}

/** WhatsApp é o único canal real; configurações antigas de Telegram ficam desligadas. */
export function sanitizarConfig(entrada: Partial<CanalConfig>): CanalConfig {
  const canal: CanalAtivo = entrada.canal_ativo === 'ultramsg' ? entrada.canal_ativo : 'desligado';
  return {
    canal_ativo: canal,
    modo_teste: canal !== 'desligado' ? true : entrada.modo_teste ?? true,
    agente_ativo: canal !== 'desligado' && entrada.agente_ativo === true,
    fonte_sugestoes: entrada.fonte_sugestoes === 'agente' ? 'agente' : 'ia_manager',
  };
}

/** Mascara chat_id para exibição e logs: "••••1234". */
export function mascararContato(contatoExterno: string): string {
  return `••••${contatoExterno.slice(-4).padStart(4, '•')}`;
}

/** Resumo seguro para o log de auditoria: nunca telefone, chat_id ou texto integral. */
export function resumoEnvio(canal: string, contatoExterno: string, telefoneFicticio: string, tamanho: number): string {
  return `${canal} → ${mascararContato(contatoExterno)} · ${mascararTelefone(telefoneFicticio)} · ${tamanho} caracteres`;
}

/** Ações do Atendimento que passam pelo canal; as demais seguem simuladas. */
export const acoesMensagem = ['enviarMensagem', 'enviarHorarios', 'solicitarDocumentos', 'solicitarFaltantes', 'enviarListaProvas', 'lembrete'] as const;

export function etiquetaAcao(acao: string, config: CanalConfig): 'Real (WhatsApp)' | 'Real (Telegram)' | 'Simulado' {
  if (!(acoesMensagem as readonly string[]).includes(acao)) return 'Simulado';
  return config.canal_ativo === 'ultramsg' ? 'Real (WhatsApp)' : 'Simulado';
}
