// Telefone brasileiro para identificação: DDD obrigatório; aceita com ou sem 55, com ou sem o 0 de longa
// distância e com ou sem o nono dígito. A chave é DDD + 8 dígitos, igual para "11 99999-0001" e "11 9999-0001".

/** Chave de comparação do telefone, ou undefined quando falta DDD ou o número é inválido. */
export function chaveTelefone(valor: string | null | undefined): string | undefined {
  let d = (valor ?? '').replace(/@.*$/, '').replace(/\D/g, '');
  // 55 só é código do país com 12 ou 13 dígitos; com 10 ou 11 dígitos, 55 é o DDD do RS.
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  else if ((d.length === 11 || d.length === 12) && d.startsWith('0')) d = d.slice(1);
  if (!/^[1-9][1-9]/.test(d)) return undefined;
  if (d.length === 11) return d[2] === '9' ? `${d.slice(0, 2)}${d.slice(3)}` : undefined;
  if (d.length === 10) return d;
  return undefined;
}

/** Os dois telefones são o mesmo número (mesma chave válida)? */
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = chaveTelefone(a);
  return Boolean(ca) && ca === chaveTelefone(b);
}
