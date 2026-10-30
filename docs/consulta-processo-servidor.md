# Consulta processual real da Ana

O servidor reutiliza `consulta-processo.ts`, as consultas fechadas ProJuris e o adaptador Claude já instalado. Não houve publicação, migração ou alteração de prompt/agenda/textos oficiais.

## Revisão

- O número da revisora fica em `REVISORA_WHATSAPP`, cadastrado no cofre. Nenhum número é incluído no código.
- Pedidos ficam em `agenteAna.pedidosProcesso` na conversa. Toda informação processual aguarda aprovação individual.
- A revisora responde pelo WhatsApp: `ok AND-xxxx`, `corrigir AND-xxxx: texto`, `não AND-xxxx`. Códigos ambíguos entre proprietários exigem decisão pelo Manager.
- Sênior/admin pode examinar e decidir na conversa ou em Aprovações. Atendente/júnior não recebe esses controles.
- Falha de envio após decisão não gera reenvio automático: conferir WhatsApp antes de repetir. Recusa pausa Ana.

## Lembretes a cada cinco minutos (não agendados nesta entrega)

Depois da autorização de publicação, criar **um agendamento HTTP gerenciado**:

- Nome: `ana-pendencias-processo`
- Método: `POST`
- Caminho: `/api/public/atendimento/pendencias-processo`
- Expressão: `*/5 * * * *`
- Corpo: `{}`

O agendamento gerenciado fornece a autorização do segredo de cron existente, validada por `authenticateCronRequest`. Não colocar o segredo em URL, código, relatório ou SQL. Não usar chave pública para autorizar.

São 288 verificações por dia; o cliente aguarda no máximo cinco minutos extras além dos intervalos do módulo (lembrete a cada 30 minutos, máximo três; aviso de retorno após 60 minutos). Verificações frequentes podem aumentar custos do Cloud mesmo sem pedidos. Uma alternativa mais econômica é execução somente enquanto houver pedidos, com um agendador externo seguro. A configuração aqui não cria nem ativa nenhum agendamento.

## Segurança e concorrência

- Índice de telefones principais em memória por 30 minutos; paginação de 100; cache parcial/vencido nunca é usado após falha.
- CAS reserva códigos por proprietário, impede consultas simultâneas na mesma conversa e disputa decisões/lembretes.
- Pedidos são salvos antes da notificação à revisora para não perder resposta imediata. Falha de notificação mantém o pedido disponível no Manager.
- Destino aprovado é relido e comparado ao telefone do pedido. Auditoria registra somente categorias técnicas, nunca conteúdo ou nomes/telefones/processos.

## Arquivos alterados e criados

- `src/lib/atendimento/ana.server.ts`
- `src/lib/atendimento/ana-rules.ts` (campos opcionais, sem alterar textos oficiais)
- `src/lib/atendimento/consulta-processo.server.ts`
- `src/lib/atendimento/consulta-processo.functions.ts`
- `src/lib/atendimento/processo-redacao.server.ts`
- `src/lib/atendimento/canais/ultramsg.ts`
- `src/lib/projuris/indice.server.ts`
- `src/lib/casos.ts`
- `src/lib/office-store.ts`
- `src/routes/api/public/atendimento/whatsapp.ts`
- `src/routes/api/public/atendimento/pendencias-processo.ts`
- `src/routes/_authenticated/atendimento.tsx`
- `src/routes/_authenticated/aprovacoes.tsx`
- `src/components/office/approvals.tsx`
- `src/components/office/process-reviews.tsx`
- `src/test/ana-consulta-processo-servidor.test.ts`
- `src/test/projuris-indice-servidor.test.ts`
- `src/test/whatsapp-entrada.test.ts`
- `src/test/production-channel.test.ts` (asserções antigas corrigidas para os três números já autorizados e equivalência com/sem nono dígito, sem alterar lista)
- `AGENTS.md`, `src/lib/atendimento/AGENTS.md`, `roadmap.md`
- `docs/consulta-processo-servidor.md`

## Verificação e limites

A suíte completa inclui `src/test/ana-bateria-regressao.test.ts`. Foram exercitados consulta, pedido persistido, espera, hash alterado, aprovação, correção, recusa, replay, terceiros, autorização, cache e lembretes com provedores e persistência substituídos em testes.

Na prévia, a sessão real autorizada abriu Aprovações e consultou a fila autenticada: zero pedidos pendentes. O endpoint de lembretes recusou chamada sem autorização com 401. A navegação inicial apresentou avisos recuperáveis de hidratação; a seção de revisões apareceu normalmente. Nenhum cliente/processo fictício foi inserido no escritório e nenhuma mensagem externa foi enviada. Portanto, consulta e decisão reais pelo WhatsApp ainda não foram confirmadas ponta a ponta. Não foi publicado nem agendado.