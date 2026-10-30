// Vínculo da conversa com uma pessoa do ProJuris. Regras puras, sem rede.
// O telefone principal identifica direto; pelo CPF o vínculo fica PENDENTE até a confirmação de sênior/admin.
// O CPF nunca vai para log; na conversa fica só mascarado.

export interface VinculoProjuris {
  codigoPessoa: number;
  nome: string;
  status: 'confirmado' | 'pendente';
  origem: 'telefone' | 'cpf';
  cpfMascarado?: string;
  desde: string;
  confirmadoPor?: string;
  confirmadoEm?: string;
}

export const TEXTOS_VINCULO = {
  pedirCpf: 'Para localizar seu cadastro, pode me informar seu CPF?',
  pendente: 'Obrigada! Vou confirmar seu cadastro com a equipe e te retorno em seguida.',
};

/** CPF válido (dígitos verificadores) ou undefined. */
export function cpfValido(valor: string | null | undefined): string | undefined {
  const d = (valor ?? '').replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return undefined;
  const dv = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const r = (soma * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]) ? d : undefined;
}

/** Primeiro CPF válido escrito na mensagem. */
export function cpfNoTexto(texto: string): string | undefined {
  for (const m of texto.matchAll(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g)) {
    const c = cpfValido(m[0]);
    if (c) return c;
  }
  return undefined;
}

/** "***.456.789-**": o suficiente para a equipe conferir, sem guardar o número inteiro. */
export function mascararCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '***';
}

export interface PessoaCpf { codigo: number; nome: string; cpf?: string }

/** Só aceita a pessoa cujo CPF é exatamente o informado; nenhum ou mais de um não escolhe ninguém. */
export function pessoaPorCpf(cpf: string, candidatos: PessoaCpf[]): PessoaCpf | undefined {
  const alvo = cpfValido(cpf);
  if (!alvo) return undefined;
  const iguais = [...new Map(candidatos.filter(p => (p.cpf ?? '').replace(/\D/g, '') === alvo).map(p => [p.codigo, p])).values()];
  return iguais.length === 1 ? iguais[0] : undefined;
}

export function vinculoPorTelefone(p: { codigo: number; nome: string }, agora: Date): VinculoProjuris {
  return { codigoPessoa: p.codigo, nome: p.nome, status: 'confirmado', origem: 'telefone', desde: agora.toISOString() };
}

export function vinculoPendentePorCpf(p: PessoaCpf, cpf: string, agora: Date): VinculoProjuris {
  return { codigoPessoa: p.codigo, nome: p.nome, status: 'pendente', origem: 'cpf', cpfMascarado: mascararCpf(cpf), desde: agora.toISOString() };
}

/** Confirmação pela equipe: só um vínculo pendente vira confirmado. */
export function confirmarVinculo(v: VinculoProjuris | undefined, por: string, agora: Date): VinculoProjuris {
  if (!v || v.status !== 'pendente') throw new Error('Não há vínculo pendente para confirmar.');
  return { ...v, status: 'confirmado', confirmadoPor: por, confirmadoEm: agora.toISOString() };
}
