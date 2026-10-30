// Preparatory contracts only. No provider request is executed by this module.
// Future execution remains behind the authenticated n8n service layer.
export const integrationContracts = {
  claude: {
    baseUrl: 'https://ai.gateway.lovable.dev',
    path: '/v1/messages',
    model: 'anthropic/claude-sonnet-5',
    stream: true,
    max_tokens: 16000,
    credential: 'LOVABLE_API_KEY',
    documentation: 'https://platform.claude.com/docs',
  },
  zapsign: {
    baseUrl: 'https://api.zapsign.com.br',
    credential: 'ZAPSIGN_API_TOKEN',
    auth: 'bearer',
    readPath: '/api/v1/docs/?page=1',
    createPath: '/api/v1/docs/',
    documentation: 'https://docs.zapsign.com.br',
  },
  mercadopago: {
    baseUrl: 'https://api.mercadopago.com',
    credential: 'MERCADOPAGO_ACCESS_TOKEN',
    auth: 'bearer',
    createPath: '/v1/payments',
    idempotencyHeader: 'X-Idempotency-Key',
    documentation: 'https://www.mercadopago.com.br/developers/pt/docs',
  },
  ultramsg: {
    baseUrl: 'https://api.ultramsg.com',
    instanceCredential: 'ULTRAMSG_INSTANCE_ID',
    credential: 'ULTRAMSG_TOKEN',
    readPath: '/{instance_id}/instance/status',
    sendPath: '/{instance_id}/messages/chat',
    documentation: 'https://docs.ultramsg.com',
  },
} as const;