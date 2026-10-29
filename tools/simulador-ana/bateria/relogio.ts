// Relógio simulado só durante a execução de um cenário: new Date() e Date.now() passam a marcar o horário do
// cenário e avançam quando o roteiro manda. Os cenários rodam um de cada vez; o relógio real volta ao final.
export interface Relogio { avancarMin(min: number): void; agora(): Date }

export async function comRelogio<T>(inicio: Date, fn: (r: Relogio) => Promise<T>): Promise<T> {
  const Real = Date;
  let deslocamento = inicio.getTime() - Real.now();
  class DataSimulada extends Real {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(Real.now() + deslocamento);
      else super(...(args as [string | number | Date]));
    }
    static override now() { return Real.now() + deslocamento; }
  }
  globalThis.Date = DataSimulada as unknown as DateConstructor;
  try {
    return await fn({ avancarMin: min => { deslocamento += min * 60000; }, agora: () => new Real(Real.now() + deslocamento) });
  } finally {
    globalThis.Date = Real;
  }
}
