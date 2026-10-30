// Funções puras de telefone do Atendimento.

/** Só dígitos; com 10 ou 11 dígitos (DDD + número) acrescenta o código do Brasil (55). */
export function normalizarTelefone(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  return digitos;
}

/** Chave de comparação: DDD + últimos 8 dígitos, ignorando código do país e o 9 extra. */
export function chaveTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor);
  const local = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos;
  return local.slice(0, 2) + local.slice(-8);
}

/** Exibição segura: "(11) •••••-0001". */
export function mascararTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor);
  const local = digitos.startsWith('55') && digitos.length >= 12 ? digitos.slice(2) : digitos;
  const ddd = local.slice(0, 2).padEnd(2, '•');
  const final = local.slice(-4).padStart(4, '•');
  return `(${ddd}) •••••-${final}`;
}
