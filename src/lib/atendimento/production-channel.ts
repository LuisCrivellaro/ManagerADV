import { normalizarTelefone } from './telefone';

/** Temporary production restriction; change only with the office owner's authorization. */
export const numerosUltraMsgPermitidos = ['5511999600306', '5511942074361'] as const;
export function numeroUltraMsgPermitido(valor: string): boolean {
  if (/@(?:g\.us|broadcast|newsletter)$/.test(valor)) return false;
  const telefone = normalizarTelefone(valor.replace(/@.*$/, ''));
  return numerosUltraMsgPermitidos.some(numero => numero === telefone);
}