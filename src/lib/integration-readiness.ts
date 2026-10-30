export const integrationCatalog = [
  { id: 'claude', name: 'Claude', purpose: 'Análise jurídica e revisão', documentation: 'https://platform.claude.com/docs', requirements: [{ key: 'LOVABLE_API_KEY', label: 'Conexão Lovable AI' }], model: 'anthropic/claude-sonnet-5' },
  { id: 'zapsign', name: 'ZapSign', purpose: 'Contratos e assinaturas', documentation: 'https://docs.zapsign.com.br', requirements: [{ key: 'ZAPSIGN_API_TOKEN', label: 'Token da ZapSign' }] },
  { id: 'mercadopago', name: 'Mercado Pago', purpose: 'Cobranças e confirmação de pagamento', documentation: 'https://www.mercadopago.com.br/developers/pt/docs', requirements: [{ key: 'MERCADOPAGO_ACCESS_TOKEN', label: 'Access Token do Mercado Pago' }] },
  { id: 'ultramsg', name: 'UltraMsg', purpose: 'Mensagens e documentos pelo WhatsApp', documentation: 'https://docs.ultramsg.com', requirements: [{ key: 'ULTRAMSG_INSTANCE_ID', label: 'Identificador da instância' }, { key: 'ULTRAMSG_TOKEN', label: 'Token da UltraMsg' }] },
] as const;

export function integrationReadiness(configured: Record<string, boolean>) {
  return integrationCatalog.map(service => ({
    id: service.id,
    credentialsPresent: service.requirements.every(r => configured[r.key] === true),
    missing: service.requirements.filter(r => configured[r.key] !== true).map(r => r.label),
    // Credential presence is not proof of provider access or permission to send.
    active: false as const,
  }));
}