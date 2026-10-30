# Preparação das integrações do Manager ADV

> Documento histórico de preparação. O estado atual de 27/10/2026 está em `CONTINUAR-NO-CLAUDE.md`: Ana usa Anthropic direto; Calendar e Drive têm conectores reais; Telegram é teste temporário e UltraMsg está pausado. As descrições de inatividade abaixo não prevalecem sobre o código atual.

## Estado desta entrega

Configurações consulta apenas a presença de credenciais, sem devolver seus valores. Nenhum serviço novo foi ativado; a IA existente e as simulações n8n permanecem inalteradas. Os contratos em `src/services/integration-contracts.ts` são referências para futura implementação, não clientes executáveis. Não existem novos webhooks publicados.

## Claude

- Modelo encontrado no catálogo autenticado: `anthropic/claude-sonnet-5`, superfície `messages`.
- Usar Lovable AI, não chave Anthropic. Endpoint nativo `/v1/messages`, streaming obrigatório, orçamento de 16.000 tokens para o teste futuro, resposta estruturada via `output_config.format` quando necessário.
- Usar o helper existente de Run-ID; não inventar identificadores. Não alterar as chamadas Responses atuais.
- Antes da ativação: testar com entrada fictícia, preservar erros seguros e recusas; não repetir denegações nem substituir modelo. A presença da chave e a listagem do modelo não provam inferência bem-sucedida. Nenhum documento jurídico foi enviado ao Claude nesta preparação.

## ZapSign

- Token privado `ZAPSIGN_API_TOKEN`; autenticação Bearer.
- Base e caminhos documentados no contrato. Teste futuro: listar documentos (somente servidor e caller autorizado; não devolver documentos de todo o escritório a atendentes).
- Antes de criar contrato: implementar seleção do original, confirmação humana, persistência do vínculo do documento e estado de assinatura. Nunca inserir contrato advocatício no pacote judicial.
- Webhook: confirmar autenticação por cabeçalho suportada pela conta antes de criar receptor. Um evento de assinatura não pode liberar etapas jurídicas automaticamente.
- Fonte: https://docs.zapsign.com.br/documentos/criar-documento e https://docs.zapsign.com.br/webhooks/criar-webhook.

## Mercado Pago

- Token privado `MERCADOPAGO_ACCESS_TOKEN`; não é Public Key.
- Escolher fluxo de cobrança e ambiente de testes antes da implementação; `POST /v1/payments` é referência, não uma cobrança ativa.
- Criações precisam de chave de idempotência persistida, valor validado e confirmação humana. Não marcar pago pelo retorno do navegador.
- Webhooks do produto escolhido precisam de validação `x-signature` / `x-request-id` e consulta do pagamento no servidor. Distinguir pago, pendente, cancelado e estornado; impedir eventos duplicados.
- Fonte: https://www.mercadopago.com.br/developers/en/reference/online-payments/checkout-api-payments/create-payment/post e https://www.mercadopago.com.br/developers/en/docs/your-integrations/notifications/webhooks.

## UltraMsg

- Credenciais privadas: `ULTRAMSG_INSTANCE_ID` e `ULTRAMSG_TOKEN`.
- Teste futuro: status da instância; para envio, validar destinatário, texto/anexo e confirmar antes de chamar `messages/chat`.
- Não registrar token em URL ou logs. Não considerar mensagem enviada só porque a credencial existe.
- Documentação consultada não estabelece assinatura padrão de webhook; confirmar proteção antes de aceitar eventos. Conteúdo recebido nunca é instrução confiável para IA.
- Fonte: https://docs.ultramsg.com/api/get/instance/status e https://docs.ultramsg.com/api/post/messages/chat.

## Status das mensagens (enviada, entregue, vista)

- O Atendimento mostra o status gravado em cada mensagem do escritório. Hoje só existem `simulada` (canal desligado) e `enviada` (canal confirmou o envio).
- Telegram: a Bot API confirma o envio, mas não informa entrega nem leitura; mensagens pelo Telegram param em `enviada`.
- WhatsApp: entrega e leitura dependem do webhook de confirmação do provedor. Antes de ativar, confirmar na documentação oficial o evento, o formato e a forma de autenticar o webhook; localizar a mensagem por `idExterno` e aplicar `avancarStatus` (nunca regride). Nada de inferir "vista" porque o cliente respondeu.

## Próximo passo

As três APIs externas não constam no catálogo de conectores disponível nesta sessão. Confirmar armazenamento privado e solicitar credenciais em formulário seguro, nunca em chat, código ou campos de perfil. Ativar por serviço, com permissões verificadas no servidor, teste real controlado e publicação posterior. Não habilitar operações reais apenas desligando demonstração.