// Simulador: não envia nada; devolve ok e registra como "enviado (simulado)".
import type { AdaptadorCanal, ResultadoEnvio } from './tipos';

export async function enviarTextoSimulado(): Promise<ResultadoEnvio> {
  return { ok: true, idExterno: `sim-${crypto.randomUUID()}` };
}

export const simuladorAdapter: AdaptadorCanal = {
  nome: 'simulador',
  enviarTexto: () => enviarTextoSimulado(),
};
