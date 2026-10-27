import { describe, expect, it } from 'vitest';
import { integrationReadiness } from '@/lib/integration-readiness';

describe('preparação de integrações', () => {
  it('não ativa serviços mesmo quando todas as credenciais existem', () => {
    const rows = integrationReadiness({ LOVABLE_API_KEY: true, ZAPSIGN_API_TOKEN: true, MERCADOPAGO_ACCESS_TOKEN: true, ULTRAMSG_INSTANCE_ID: true, ULTRAMSG_TOKEN: true });
    expect(rows.map(r => r.active)).toEqual([false, false, false, false]);
    expect(rows.every(r => r.credentialsPresent)).toBe(true);
  });
  it('exige instância e token da UltraMsg, não apenas token', () => {
    const status = integrationReadiness({ ULTRAMSG_TOKEN: true }).find(r => r.id === 'ultramsg');
    expect(status?.credentialsPresent).toBe(false);
    expect(status?.missing).toEqual(['Identificador da instância']);
  });
  it('detecta ausência de credenciais para assinatura e cobrança', () => {
    const rows = integrationReadiness({});
    expect(rows.find(r => r.id === 'zapsign')?.credentialsPresent).toBe(false);
    expect(rows.find(r => r.id === 'mercadopago')?.credentialsPresent).toBe(false);
  });
});