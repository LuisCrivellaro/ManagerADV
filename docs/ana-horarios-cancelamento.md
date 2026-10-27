# Ajustes da agenda da Ana — 27/10/2026

Claude, prompt ativo, contrato JSON, canais, aprovações e banco preservados. Nenhum compromisso ou envio externo foi criado para estes testes.

## Arquivos desta conclusão
- `src/lib/atendimento/ana-scheduling.ts`: preferência “mais tarde” aplicada ao período da tarde.
- `src/lib/atendimento/ana.server.ts`: confirmação de cancelamento válida só depois do envio da pergunta; desistência limpa autorizações pendentes de alteração.
- `src/test/ana-agenda-opcoes.test.ts`: horizonte de 15 dias úteis corrigido no teste e preferência por período.
- `src/test/ana-agenda-consentimento.test.ts`: sequências completas nos dois canais, consentimento, desistência, falha, vencimento, remarcação e novas ofertas.
- `AGENTS.md`, `roadmap.md` e este relatório: regras e situação da entrega.

Os ajustes de formato, histórico de ofertas, reconhecimento de frustração e confirmação posterior já iniciados estão em `ana-rules.ts`, `ana-scheduling.ts`, `ana.server.ts`, `appointment-management.ts` e `google-calendar.server.ts`.

## Exemplos ilustrativos das mensagens
Datas e horários abaixo são exemplos de formato, não disponibilidade verificada nem novas reservas.

### Primeira lista
Claro! Seguem os horários livres para a sua consulta online e gratuita:

🗓️ Consulta online (30 min, horário de Brasília):
• Hoje (ter, 27/10) · 16h às 16h30
• Amanhã (qua, 28/10) · 9h às 9h30
• Qui, 29/10 · 14h às 14h30

Qual fica melhor para você? Se preferir, me diga outro dia ou horário.

### Outras opções
Tenho estas outras opções:

🗓️ Outras opções (30 min, horário de Brasília):
• Seg, 09/11 · 9h às 9h30
• Ter, 10/11 · 13h às 13h30
• Qua, 11/11 · 9h às 9h30

Qual fica melhor para você? Se preferir, me diga outro dia ou horário.

Na segunda solicitação sem preferência, a pergunta final passa a: “Prefere algum dia da semana ou período, manhã ou tarde?”.

### Frustração com horários
Desculpe! Aqui vão opções diferentes:

🗓️ Outras opções (30 min, horário de Brasília):
• Seg, 16/11 · 9h às 9h30
• Ter, 17/11 · 13h às 13h30
• Qua, 18/11 · 9h às 9h30

Qual fica melhor para você? Se preferir, me diga outro dia ou horário.

### Confirmação de cancelamento
Quer mesmo cancelar a sua consulta de quarta, 28/10, às 9h? Se preferir, posso remarcar para outro dia.

### Cancelamento concluído
Pronto, sua consulta de quarta, 28/10, às 9h foi cancelada. Se quiser marcar outro dia, é só me chamar.

### Desistência, ausência e falha
- “Combinado, sua consulta continua marcada para quarta, 28/10, às 9h.”
- “Não encontrei consulta marcada por aqui. Quer marcar uma?”
- “Não consegui cancelar agora. Deixei registrado e a equipe vai confirmar com você.”

Publicação e teste externo pelo Telegram continuam pendentes de autorização e nova mensagem da Dra.; UltraMsg permanece pausado.