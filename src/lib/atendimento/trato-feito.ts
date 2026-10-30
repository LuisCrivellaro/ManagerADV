import type { Conversa, DocItem } from '@/lib/mock-data';
import { etiquetaConversa } from './intake-rules';

/** Documentos base pedidos ao cliente logo após o "Trato feito". */
export const DOCUMENTOS_BASE = ['RG ou CNH', 'CPF', 'Comprovante de endereço', 'E-mail'] as const;
/** Documentos do escritório gerados para assinatura. */
export const DOCUMENTOS_CONTRATO = ['Contrato de prestação de serviços', 'Declaração de hipossuficiência'] as const;

/** Pasta do cliente na categoria AC ou RT; sem etiqueta fica em "Sem categoria" para a equipe classificar. */
export function pastaCliente(c: Pick<Conversa, 'nome' | 'atendimento' | 'etiquetaAcao' | 'mensagens'>) {
  const e = etiquetaConversa(c as Conversa);
  const categoria = e === 'AC' ? 'AC - Ação Cível' : e === 'RT' ? 'RT - Trabalhista' : 'Sem categoria';
  return `${categoria}/${c.nome} – ${c.atendimento}`;
}

export function mensagemTratoFeito(nome: string) {
  const n = nome.split(' ')[0] || nome;
  return `Oi, ${n}! Que bom seguir com você 😊\nPara iniciarmos, envie por aqui:\n${DOCUMENTOS_BASE.map(d => `• ${d}`).join('\n')}\n\nEquipe CS Advocacia`;
}

/** Inclui os documentos base no checklist sem duplicar nem desmarcar itens já recebidos. */
export function comDocumentosBase(docs: DocItem[]): DocItem[] {
  const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const has = (n: string) => docs.some(d => fold(d.nome).includes(fold(n).split(' ')[0] ?? '') || fold(n).includes(fold(d.nome)));
  return [...docs, ...DOCUMENTOS_BASE.filter(n => !has(n)).map(nome => ({ nome, recebido: false }))];
}

export type FaseTrato = 'documentos_base' | 'assinatura' | 'faltantes' | 'pronto_producao';

/** Fase atual após o Trato feito: base → contrato assinado → faltantes → pronto para Produção. */
export function faseTrato(c: Pick<Conversa, 'documentos' | 'contrato'>): FaseTrato {
  const base = c.documentos.filter(d => DOCUMENTOS_BASE.some(b => b === d.nome));
  if (base.some(d => !d.recebido)) return 'documentos_base';
  if (c.contrato !== 'assinado') return 'assinatura';
  if (c.documentos.some(d => !d.recebido)) return 'faltantes';
  return 'pronto_producao';
}

/** Aviso para a Dra.: só quando tudo foi juntado e o contrato está assinado; Produção continua manual. */
export function avisoProducao(c: Pick<Conversa, 'nome' | 'atendimento' | 'documentos' | 'contrato'>) {
  if (faseTrato(c) !== 'pronto_producao') return undefined;
  return `Dra. Carolina, o atendimento ${c.atendimento} (${c.nome}) está com contrato assinado e todos os documentos juntados. Aperte "Produção" para iniciar.`;
}
