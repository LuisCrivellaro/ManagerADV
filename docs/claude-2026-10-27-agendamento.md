# Ajustes feitos no Claude — 27/10/2026 (noite)

Base: snapshot `manager-adv-claude-2026-10-27-v4`. Nenhuma migração, RLS, função de banco, modelo, contrato JSON, canal ou segredo foi alterado. Nada foi publicado nem enviado.

## 1. Correção: primeira lista de horários depois de pedir o nome

**Problema (confirmado no código original):** quando o cliente pedia para agendar antes de dizer o nome, a Ana pedia o nome e o servidor guardava 3 horários fictícios que nunca foram mostrados. Quando o nome chegava, a primeira lista real saía como “Tenho estas outras opções:” e deixava de fora justamente os 3 primeiros horários livres.

**Correção em `src/lib/atendimento/ana.server.ts`:**
- só guarda `horariosTeste` quando a lista veio da agenda real (`agendaReal`);
- horários fictícios salvos antes da correção (`agendaReal` falso) não entram no histórico de ofertas, então conversas antigas também se corrigem sozinhas.

**Testes novos** em `src/test/ana-agenda-consentimento.test.ts` (2).

## 2. Ana só para agendamentos (por enquanto)

**Prompt (`ana-prompt.txt`) e restrições (`ana-restrictions.txt`):**
- nova seção “O QUE VOCÊ FAZ (POR ENQUANTO, SÓ AGENDAMENTO)”;
- saudação: “Olá! Sou a Ana, assistente virtual da CS Lawyers | Advocacia. Por aqui eu cuido do agendamento de consultas. Como posso te ajudar?”;
- sem perguntas de triagem sobre o caso: acolhe, diz que a Dra. Carolina avalia na consulta e oferece marcar;
- assuntos que só a equipe resolve (processo, documentos, contrato, pagamento, audiência, perícia, prazo, recado) passam para a equipe;
- outros assuntos: explica com gentileza que cuida só dos agendamentos e oferece marcar a consulta ou passar para a equipe;
- modelos de mensagem: só 3 (remarcação), 4 (confirmação do dia) e 10 (lembrete).

**Mensagens fixas do servidor (`ana-rules.ts`):**
- passagem para a equipe iniciada pela Ana (sem pedido explícito do cliente): “Por aqui eu cuido só dos agendamentos, então passei sua conversa para a equipe.” + a linha de prazo de sempre. Pedido explícito continua com “Claro! Já passei sua conversa para a equipe.”;
- pergunta jurídica/tema proibido: “Entendo. Essa pergunta precisa da avaliação da Dra. Carolina, e deixei registrado para a equipe. Por aqui eu cuido só dos agendamentos: se quiser, marco uma consulta online e gratuita para você conversar com ela.” (antes: “Posso continuar anotando as informações do seu atendimento.”);
- reclamação: “Sinto muito por isso. Deixei registrado para a equipe olhar com cuidado.”.
- Mantido: intenção `processo` continua virando rascunho (regra de segurança testada); o prompt orienta a Ana a passar para a equipe nesses casos.

**Testes novos** em `src/test/ana-rules.test.ts` (4).

## 3. Simulador da Ana (`tools/simulador-ana/`)

Página que roda o fluxo de `processarAna` com os módulos reais, agenda fictícia e Claude pela página do claude.ai. Não faz parte do sistema publicado. Como gerar: ver `tools/simulador-ana/vite.config.ts`. Teste do motor: `bunx vitest run --config tools/simulador-ana/vitest.config.ts`.

## Verificações

- `bunx vitest run`: 344 testes aprovados em 44 arquivos (eram 338).
- `bunx tsc --noEmit`: sem erros.
- Não verificado: comportamento real do Claude com o prompt novo no Telegram/WhatsApp, publicação na Lovable e reserva real no Google Calendar.

## Para publicar

1. Levar estes arquivos para a Lovable (GitHub conectado, sem gastar créditos).
2. Publicar.
3. Testar pelo Telegram de teste: pedir para agendar antes do nome, conferir que a primeira lista começa com “Claro! Seguem os horários livres…”; perguntar de processo e conferir a passagem para a equipe.

---

# Parte 2 — WhatsApp do escritório (celular próprio) · 27/10/2026, 18h

A doutora tem um celular só para o escritório, então a Ana pode atender todo mundo que escrever nesse número.

## O que mudou
- **Entrada aberta (chave no Canal e Agente → "WhatsApp do escritório")**: com a chave ligada, qualquer número que escrever ganha uma conversa na conta de quem ligou a chave (advogada sênior ou admin) e o contato fica liberado automaticamente. Com a chave desligada, vale a lista manual de antes.
- **Bloquear**: contato marcado como Bloqueado nunca é atendido pela Ana, mesmo com a entrada aberta.
- **Grupos, listas de transmissão e status** são sempre ignorados.
- **Resposta da equipe pelo celular**: quando alguém responde pelo celular do escritório, a mensagem aparece na conversa como "Equipe · celular do escritório" e a Ana para naquela conversa até alguém tocar em "Retomar Ana". Mensagens enviadas pela própria Ana ou pelo Manager são reconhecidas pelo texto e não pausam nada. Mensagens do escritório para números que não estão no Manager não são registradas.
- **Registrar recebimento do WhatsApp** agora liga no UltraMsg o aviso de mensagens criadas no próprio número (`webhook_message_create`).

## Arquivos
- novos: `src/lib/atendimento/entrada-whatsapp.ts` (regras puras), `src/lib/atendimento/entrada-whatsapp.server.ts` (dona da entrada e abertura de conversa), `src/test/whatsapp-entrada.test.ts` (9 testes);
- alterados: `src/routes/api/public/atendimento/whatsapp.ts`, `src/lib/atendimento/envio.functions.ts` (ler/salvar entrada; `webhook_message_create: 'true'`), `src/components/office/canal-agente.tsx` (chave e textos), `src/lib/office-store.ts` e `src/lib/office.ts` (a tela nunca sobrescreve a entrada salva pelo servidor), `.env.example` (`WHATSAPP_ESPERA_MANUAL_MS`, opcional).
- Sem migração: a configuração fica na área de trabalho (JSON) de quem abriu a entrada; contatos e conversas usam as tabelas existentes.

## Verificações
- `bunx vitest run`: 353 testes aprovados em 45 arquivos.
- `bunx tsc --noEmit` sem erros; `bun run build` concluído.
- Não verificado: o comportamento real do UltraMsg com `webhook_message_create` (a documentação não diz se inclui mensagens digitadas no celular, só que é o aviso de "mensagens criadas"). Testar após publicar.

## Passo a passo para ligar hoje
1. Levar o código para a Lovable e publicar.
2. No UltraMsg, conferir que a instância está conectada ao **celular do escritório**.
3. No Manager → Atendimento → Canal e Agente:
   - Canal de mensagens: **WhatsApp (UltraMsg)** (o Telegram desliga sozinho, só um canal fica ativo);
   - tocar em **Registrar recebimento do WhatsApp** (uma vez);
   - Agente de IA: **ligado**;
   - WhatsApp do escritório → **Atender todo mundo que escrever: ligado** (feito pela conta da Dra. Carolina, para as conversas entrarem na conta dela).
4. Teste real: de outro celular, mandar "Olá Dra. Carolina, gostaria de agendar uma consulta gratuita." → a conversa aparece no Atendimento e a Ana responde. Pedir horário, escolher e conferir o evento na agenda.
5. Teste da pausa: responder essa conversa pelo celular do escritório → a mensagem aparece como "Equipe · celular do escritório", a Ana para; tocar em "Retomar Ana" devolve.
