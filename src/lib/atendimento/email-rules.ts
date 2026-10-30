import { z } from 'zod';
import type { DocItem, Mensagem } from '@/lib/mock-data';

/** Só um endereço válido e inequívoco informado pelo próprio cliente. */
export function emailDaMensagem(m: Pick<Mensagem, 'de' | 'texto'>): string | undefined {
  if (m.de !== 'cliente') return undefined;
  const texto = m.texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(?:nao (?:e|eh|use|utilize)|email (?:antigo|errado)|e-mail (?:antigo|errado)|email d[ao]|e-mail d[ao])\b/.test(texto)) return undefined;
  const matches = [...new Set((m.texto.match(/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).map(e => e.toLowerCase()))];
  const email = matches[0];
  return matches.length === 1 && z.string().email().max(254).safeParse(email).success ? email : undefined;
}

export function itemEmail(nome: string) {
  return /^(?:e-?mail|correio eletronico)(?: (?:do cliente|para contato|de contato))?$/.test(nome.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim());
}

export function solicitarEmailPendente(itens: Pick<DocItem, 'nome' | 'recebido'>[], email?: string) {
  return !email && itens.some(i => itemEmail(i.nome) && !i.recebido);
}