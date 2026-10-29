// Identificação pelo telefone do canal: só conta o telefone marcado como principal no ProJuris.
// Duplicidade nunca escolhe uma pessoa: o servidor registra o motivo e passa para a equipe.
import { chaveTelefone } from './telefone';

export interface TelefonePessoa { numero: string; principal: boolean }
export interface PessoaComTelefones { codigo: number; nome: string; telefones: TelefonePessoa[] }

export type Identificacao =
  | { tipo: 'telefone_invalido' }
  | { tipo: 'nao_encontrado' }
  | { tipo: 'unico'; pessoa: { codigo: number; nome: string } }
  | { tipo: 'duplicado'; codigos: number[] };

/** Índice telefone principal → códigos de pessoa. Fica só no servidor; nunca vai ao navegador. */
export function indiceTelefonesPrincipais(pessoas: PessoaComTelefones[]): Map<string, number[]> {
  const indice = new Map<string, number[]>();
  for (const p of pessoas) {
    for (const t of p.telefones) {
      const chave = t.principal ? chaveTelefone(t.numero) : undefined;
      if (!chave) continue;
      const codigos = indice.get(chave) ?? [];
      if (!codigos.includes(p.codigo)) codigos.push(p.codigo);
      indice.set(chave, codigos);
    }
  }
  return indice;
}

/** Decide a identificação a partir das pessoas candidatas (já consultadas no ProJuris). */
export function identificarPorTelefone(telefone: string, pessoas: PessoaComTelefones[]): Identificacao {
  const chave = chaveTelefone(telefone);
  if (!chave) return { tipo: 'telefone_invalido' };
  const codigos = indiceTelefonesPrincipais(pessoas).get(chave) ?? [];
  if (!codigos.length) return { tipo: 'nao_encontrado' };
  if (codigos.length > 1) return { tipo: 'duplicado', codigos: [...codigos].sort((a, b) => a - b) };
  const pessoa = pessoas.find(p => p.codigo === codigos[0]);
  return pessoa ? { tipo: 'unico', pessoa: { codigo: pessoa.codigo, nome: pessoa.nome } } : { tipo: 'nao_encontrado' };
}
