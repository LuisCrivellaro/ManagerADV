Quero ajustar a agenda da Ana no Atendimento (ana.server.ts e regras de agenda). Não troque o modelo, o prompt da Ana nem o contrato de saída JSON. Faça o seguinte:

1. Novo formato da mensagem de horários
   Primeira lista da conversa:

   Claro! Seguem os horários livres para a sua consulta online e gratuita:

   🗓️ Consulta online (30 min, horário de Brasília):
   • Hoje (ter, 27/10) · 16h às 16h30
   • Amanhã (qua, 28/10) · 9h às 9h30
   • Qui, 29/10 · 14h às 14h30

   Qual fica melhor para você? Se preferir, me diga outro dia ou horário.

   - Tire a frase "de 30 minutos" do texto de abertura; a duração aparece só no título "(30 min, horário de Brasília)".
   - Use marcadores (•), sem números. Não peça para o cliente responder com número.
   - Continue aceitando a escolha por dia e hora ("quinta às 14h"), por dia quando houver uma só opção nele ("quinta") e por ordem ("a primeira", "a última").
   - Listas seguintes na mesma conversa: abertura curta e diferente ("Tenho estas outras opções:") e título "🗓️ Outras opções (30 min, horário de Brasília):".
   - Use o nome do cliente no máximo uma vez a cada três mensagens. Nunca comece duas mensagens seguidas com "Claro, {nome}!".

2. Outras opções quando o cliente pedir
   Considere pedido de outras opções: "tem outro horário?", "outras opções", "outro dia", "nenhum desses serve", "não posso nesses", "mais tarde", "mais cedo", "você me deu os mesmos horários", e parecidos.
   - Nunca mostre de novo um horário que já apareceu nesta conversa, a não ser que o cliente peça por ele.
   - Prefira dias que ainda não apareceram. Não basta andar 30 minutos no mesmo dia: a nova lista deve trazer dias diferentes ou outro período.
   - Misture períodos quando possível: pelo menos uma opção de manhã e uma à tarde.
   - Se o cliente disser um período ("à tarde", "de manhã") ou um dia ("sexta", "dia 30"), filtre por isso.
   - Na segunda vez que o cliente pedir outras opções sem dizer preferência, mostre a lista e pergunte: "Prefere algum dia da semana ou período, manhã ou tarde?"
   - Respeite as janelas atuais (novos: seg a qui, 9h às 17h30; cadastrados: sexta, 13h30 às 17h30, último início 17h; nunca fim de semana ou feriado). Se não houver nada novo nos próximos 15 dias úteis, diga isso numa frase e ofereça que a equipe entre em contato.

3. Frustração com os horários não é reclamação
   Frases como "mas você me deu os mesmos horários!", "esses não servem", "de novo esses?" são pedido de outras opções, não reclamação nem tema delicado.
   - Não use a resposta "Entendo. Deixei essa questão registrada para a equipe avaliar com cuidado." nesses casos.
   - Responda: "Desculpe! Aqui vão opções diferentes:" seguido da nova lista do item 2.
   - A resposta de questão delicada fica só para reclamações reais sobre o atendimento, a equipe ou o caso.

4. Cancelar depois de marcar
   Reconheça pedidos como: "quero cancelar", "cancela minha consulta", "desmarcar", "não vou poder ir".
   - Se não houver consulta marcada nesta conversa: "Não encontrei consulta marcada por aqui. Quer marcar uma?"
   - Primeiro, confirme e ofereça remarcar: "Quer mesmo cancelar a sua consulta de quarta, 28/10, às 9h? Se preferir, posso remarcar para outro dia."
   - Se o cliente confirmar ("sim", "pode", "cancela"): apague o evento no Google Calendar (com o Meet). Se o convite tinha sido enviado por e-mail, avise o cliente pelo Google. Atualize a conversa (remover a consulta agendada, linha do tempo e log de auditoria). Responda: "Pronto, sua consulta de quarta, 28/10, às 9h foi cancelada. Se quiser marcar outro dia, é só me chamar."
   - Se o cliente desistir ("não", "deixa", "vou manter"): "Combinado, sua consulta continua marcada para quarta, 28/10, às 9h."
   - Se o cliente preferir remarcar: mostre outras opções (item 2, sem o horário atual). Quando ele escolher, crie o evento novo primeiro e só depois apague o antigo; confirme o novo horário completo.
   - Nunca cancele sem a confirmação explícita, e só a consulta deste cliente.
   - Se o Google falhar, não diga que cancelou: "Não consegui cancelar agora. Deixei registrado e a equipe vai confirmar com você." e marque a conversa para a equipe.

5. Testes: crie testes para cada caso abaixo e rode todos os testes do projeto.
   - Primeira lista: abertura sem "de 30 minutos", título com "(30 min, horário de Brasília)", marcadores sem números, pergunta final sem pedir número.
   - "tem algum outro horário?" → nenhum horário repetido e pelo menos um dia que não apareceu antes.
   - "mas você me deu os mesmos horários!" → "Desculpe! Aqui vão opções diferentes:" com horários novos, sem a mensagem de questão delicada.
   - "à tarde" → só horários a partir das 13h, nenhum repetido.
   - Consulta marcada + "quero cancelar" → pergunta de confirmação com data e hora; + "sim" → evento apagado e mensagem de cancelamento.
   - Consulta marcada + "quero cancelar" + "não, vou manter" → nada apagado.
   - Consulta marcada + "quero remarcar" + escolha → evento novo criado antes de apagar o antigo.
   - Duas listas seguidas → o nome do cliente aparece no máximo uma vez.

No final, me mostre os arquivos alterados e um exemplo de cada mensagem nova (primeira lista, outras opções, resposta à frustração, confirmação de cancelamento e cancelamento concluído).
