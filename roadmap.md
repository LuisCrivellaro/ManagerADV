# Construção dos módulos Manager ADV

## Envio completo ao GitHub — 30/10/2026 (noite)
- [x] Sincronizar o projeto (373 arquivos) em LuisCrivellaro/ManagerADV (main): 3 novos, 18 atualizados, nenhuma remoção; `bun.lock` preservado do repositório; revisão a1a311712966944a4187c5d24403f06b1edef62d.
- [x] Cópia conferida arquivo por arquivo pelo hash do GitHub: 374/374 iguais (373 do projeto + `bun.lock`), sem ausentes, diferentes ou extras.
- [x] Varredura de credenciais nos 21 arquivos enviados sem achados; `.env`, `.lovable`, `node_modules`, `dist` e caches fora do repositório.

## Consulta processual no servidor real — 30/10/2026
- [x] Conferir os sete arquivos exigidos e o projeto completo (355 arquivos).
- [x] Ligar o fluxo existente ao ProJuris e Claude, com pedidos na conversa e aprovação obrigatória.
- [x] Receber comandos da revisora e disponibilizar Aprovar/Corrigir/Recusar para sênior/admin; número no cofre.
- [x] Preparar lembretes protegidos e instruções de execução a cada cinco minutos, sem agendar/publicar.
- [x] Suíte completa e bateria verificadas; página autenticada e cron sem autorização 401; arquivos e limites no relatório.
- [ ] Confirmar consulta, decisão e leitura real no WhatsApp — depende de mensagem de cliente após publicação autorizada; não há pedidos reais pendentes e nenhum dado/mensagem fictício foi inserido/enviado.

## Envio completo ao GitHub — 30/10/2026
- [x] Sincronizar os 358 arquivos do projeto em LuisCrivellaro/ManagerADV (main): 301 novos, 7 atualizados, nenhuma remoção; revisão 47537a161ba25fa2b5ec9920bc55d02dc999d7b1.
- [x] Cópia conferida arquivo por arquivo pelo hash do GitHub: 358/358 iguais, sem ausentes, diferentes ou extras.
- [x] Varredura de credenciais no conteúdo enviado sem achados; `.env`, `.lovable`, `node_modules` e arquivos de cache fora do repositório.

## ProJuris ADV, etapas 2 e 3: consulta com aprovação e bateria automática — 29/10/2026
- [x] Ana: três trechos autorizados e intenção `consulta_processo`; arquivo de redação; módulo único de consulta e aprovação (prazos com feriado, assunto, validação do rascunho, AND-xxxx com hash, comandos da revisora, lembretes, em conferência).
- [x] Simulador com ProJuris fictício, central da revisora e registro de ferramentas; 42 cenários na suíte (regressão) e tela "Bateria de testes da Ana" com Ana real, avaliação de 12 critérios e reteste só dos que falharam.
- [x] Erros achados pela bateria e corrigidos: telefones fictícios sem nono dígito realista (dado de teste); "??" sem resposta durante a espera (regra de negócio).
- [ ] Propostas aguardando a Dra.: exemplo do prompt (linhas 164-166) e passagem atual sem feriados.
- [ ] Ligar o fluxo no servidor real (webhook, revisora no WhatsApp, Manager com Aprovar/Corrigir/Recusar, rotina de lembretes) e Telegram de teste; etapa 4: cadastros.


## ProJuris ADV, etapa 1: base segura — 29/10/2026
- [x] Plano, existente e bloqueios apresentados; Dra. autorizou alterar três trechos da Ana e criar o arquivo de redação, revisora com número próprio no servidor e Telegram reativado só para testes (etapas seguintes).
- [x] `.env` protegido no .gitignore; Integrações exigem PROJURIS_CLIENT_ID e PROJURIS_CLIENT_SECRET; verificação de prontidão só autentica (sênior/admin).
- [x] Cliente ProJuris no servidor com lista fechada de consultas, token em cache, fila de 480/min, backoff, tempo-limite e 403 sem contorno; identificação por telefone principal; filtros de processo ativo, cliente, andamento privado e segredo de justiça.
- [ ] Teste de conexão pela Dra. com `tools/projuris-teste-conexao` (este ambiente não alcança o ProJuris); chave recriada antes.
- [ ] Etapa 2: aprovação de informações de processo; etapa 3: simulador; etapa 4: cadastros pela equipe.


## WhatsApp sem números — 29/10/2026
- [x] Confirmado na documentação oficial do UltraMsg que não há listas interativas nem botões; decisão da Dra.: continuar no UltraMsg, com opções em texto e sem números.
- [x] Horários pelo WhatsApp saem uma única vez, com marcadores; retirados a segunda lista numerada e o "Responda com o número do horário escolhido". Horários ausentes do texto da equipe entram com marcador. 363 testes aprovados, compilação limpa.
- [ ] Publicar e conferir com mensagem real de um dos números autorizados.
- [ ] Lista interativa real depende de migrar para a API oficial do WhatsApp (decisão futura da Dra.).

## UltraMsg restrito — 27/10/2026
- [x] Retirar Telegram dos controles e recebimento (410); recebimento removido no Telegram, contato antigo bloqueado, históricos e Claude preservados.
- [x] Restringir entrada, liberação e envio UltraMsg a 11999600306 e 11942074361; entrada geral fechada e outros contatos bloqueados. 357 testes aprovados e compilação limpa.
- [x] Ambos vinculados à conta da Dra.; UltraMsg e Ana ativos, recebimento registrado HTTP 200 e instância authenticated, sem envio fictício.
- [ ] Disponibilizar alterações publicadas e confirmar nova mensagem real — publicação e mensagem externa pendentes.

## Atualização do GitHub — 27/10/2026
- [x] Importar os 24 arquivos da revisão ca32e590 do repositório LuisCrivellaro/ManagerADV; conteúdo conferido pelos hashes do GitHub, preservando segredos e configuração hospedada.
- [x] 353 testes do projeto, 1 do simulador e 10 testes de entrada (incluindo nova proteção de leitura de bloqueios) aprovados; compilação automática limpa. Atendimento, Canal e Agente e histórico Teste WhatsApp conferidos com login da Dra., sem envio externo.
- [x] Segurança conferida antes da solicitação de publicação; Telegram ativo, UltraMsg e entrada de novos números desligados. Solicitar publicação nesta entrega.
- [ ] Confirmar nova resposta real da Ana no Telegram — depende de mensagem da Dra. após a publicação; reconhecimento de respostas do celular pelo texto exige teste antes de ativar UltraMsg.

## Continuação no Claude — 27/10/2026
- [x] Preparar ZIP v4 de 27/10/2026 sem segredos, com código atual, prompts, testes, regras, conectores e instruções de configuração/continuação.
- [x] Fonte limpa inspecionada e verificação de literais sensíveis sem achados; dados, contas, documentos e credenciais hospedados não fazem parte do ZIP. Configuração hospedada e metadados privados excluídos.

## Horários e cancelamento Ana — 27/10/2026
- [x] Aplicar ofertas com marcadores, histórico sem repetição, filtros e variedade em 15 dias úteis, sem trocar Claude/prompt/JSON; “mais tarde” filtra tarde.
- [x] Exigir confirmação posterior após envio da pergunta, manter ao desistir e encaminhar falhas sem alegar sucesso; preservar remarcação segura e auditoria.
- [x] Todos os 338 testes aprovados em 44 arquivos; exemplos e arquivos em docs/ana-horarios-cancelamento.md. Compilação limpa. Fluxos de consentimento exercitados nos dois canais com serviços substituídos, sem eventos ou mensagens reais.
- [ ] Publicar e verificar mensagem real na conversa de teste — depende de autorização de publicação e mensagem da Dra.; Teste WhatsApp aberto e conferido na prévia autenticada sem erros, com histórico anterior preservado.

## Prompt Ana v7 — 27/10/2026
- [x] Substituir identidade ativa e restrições pelas Partes A/B exatas do anexo, preservando Claude, contrato JSON e Treinamento; instrução salva não contém saudação antiga e permaneceu intacta.
- [x] Remover saudação fixa; aplicar intenção estrita, passagem humana (Retomar Ana já existe) e horários numerados, específicos e por período com disponibilidade revalidada.
- [x] 294 testes aprovados; seis respostas reais da Anthropic verificadas, incluindo saudação, recusa, horários, horário específico, tarde e encaminhamento. Compilação limpa. Fluxos dos dois canais exercitados com serviços substituídos; nenhum envio externo ou compromisso criado.
- [ ] Confirmar fluxo externo e leitura no Atendimento — depende de publicação autorizada e nova mensagem da Dra. no Telegram; sem alterar canal, conversa ou agenda durante esta troca.

## Teste temporário Telegram — 27/10/2026
- [x] Reativar recebimento/envio seguro no Telegram com Claude e conversa Teste Whatsapp, preservando controles de agenda e contatos liberados; contato Telegram existente vinculado pela conta da Dra.
- [x] Pausar UltraMsg pelo canal global sem excluir credenciais/configuração; configuração relida com Telegram ativo e Ana ligada.
- [x] 22 testes aprovados, incluindo sete fluxos por canal; recebimento local sem assinatura retorna 401 e contato não liberado é ignorado. Compilação limpa e vínculo conferido visualmente.
- [ ] Disponibilizar recebimento externo — bloqueado: publicação ainda não autorizada nesta solicitação; endpoints externos permanecem na versão Telegram aposentado (410). Registro anterior no site publicado preservado, nenhum novo webhook registrado.
- [ ] Confirmar mensagem real no Telegram — depende da publicação e envio da Dra. ao @ManagerADV2Bot; histórico da conversa preservado, sem novo agendamento ou mensagem externa durante a verificação.

## Mensagens prontas com agenda real — 27/10/2026
- [x] Preencher /consulta e /reagendar com opções reais, e confirmações/lembretes com recibo futuro verificado; preservar mensagens oficiais e envio manual.
- [x] Agenda principal chamanalei@gmail.com verificada (CalendarList/freeBusy 200); opções owner-scoped em tempo real por 14 dias, America/Sao_Paulo, reuniões de 30 min e regras existentes por carteira/feriados/bloqueios. /reagendar inclui restante de hoje; /consulta começa amanhã. Carteira ausente exige conferência manual.
- [x] Fluxo autenticado no Atendimento: /consulta preencheu 09h00/09h30 de amanhã; /confirmar sem recibo manteve variável; nenhuma mensagem enviada ou evento criado. 277 testes passaram, incluindo indisponibilidade, um/zero/dois horários, sobreposição parcial, offsets, passado, isolamento e cliques repetidos; compilação limpa.
- Audiência, perícia e julgamento permanecem manuais: não existe fonte vinculada verificável para esses campos. Ana, WhatsApp, mensagens oficiais e integração de reserva preservados. Atualização ainda não publicada nesta entrega.

## Claude direto para a Ana — 26/10/2026
- [x] Substituir apenas a inferência da Ana pela API Anthropic usando o adaptador do pacote enviado, sem trocar regras de agenda, WhatsApp, revisão ou análise jurídica; Telegram continua aposentado.
- [x] 251 testes aprovados e compilação limpa; modelos e resposta real no contrato da Ana validados pela chave Anthropic, sem enviar mensagem ao cliente nem criar compromisso.
- [ ] Disponibilizar no site publicado — depende de publicação autorizada e teste pelo WhatsApp.

## Início automático e novo teste — 24/10/2026
- [x] Novas conversas em Automática; saudação solicitada uma vez e nome completo seguido de oferta real, preservando pausas e carteira de cadastrados.
- [x] Reiniciado somente o atendimento vinculado ao número 11999600306: zero mensagens e Automática, contato liberado; sem reserva, checklist ou aprovações. Nenhum arquivo externo alterado.
- [x] 67 testes aprovados, incluindo início, nome seguido de disponibilidade e exclusão de horário ocupado; compilação limpa. Sequência testada com serviços substituídos, sem mensagem ou reserva externa.
- [ ] Confirmar sequência real no WhatsApp — depende de publicar atualização e mensagem do celular; nenhum teste externo enviado em nome do cliente.

## Reinício do teste WhatsApp — 24/10/2026
- [x] Apagar atendimento anterior do número 11999600306 e preparar conversa vazia vinculada ao contato liberado; excluídos os quatro itens antigos, sem aprovações jurídicas ou reserva vigente.
- [x] Remover para a lixeira do Google Drive somente a pasta Teste WhatsApp e seu conteúdo, conforme autorização explícita; resposta do Drive confirmou trashed=true. Demais clientes, pastas gerais e originais privados do aplicativo preservados.

## PDFs identificados na pasta Start — 23/10/2026
- [x] Gerar cópias PDF de JPG/PNG e preservar PDF existente, com nomes específicos abaixo de 100 caracteres e teto conservador de 10.000 KB; originais e revisões jurídicas preservados. WEBP permanece original com pendência explícita de conversão conferida.
- [x] Registrar tipo, descrição e recibo de PDF no atendimento; busca por hash evita reenvio após falha de persistência. 27 testes aprovados de conversão, nomes, destino Start, reanálise e falhas; compilação limpa.
- [ ] Confirmar recebimento novo e PDF no Drive publicado — depende de nova publicação e documento do cliente de teste. Conta disponível na prévia possui apenas conversas-modelo sem originais; aba Documentos conferida, sem enviar arquivo fictício ao Drive.

## E-mail cadastral pela conversa — 23/10/2026
- [x] Reconhecer e-mail válido informado pelo cliente sem anexo, salvar no cadastro e marcar o item real do checklist; preservar confirmação de alteração de checklist aprovado.
- [x] Fornecer checklist real e e-mail cadastrado à Ana, solicitar dado faltante na coleta e impedir nova cobrança após recebimento.
- [x] Testar reconhecimento, isolamento, persistência, aprovações, reentrega e cadastro visível; e-mail real já recebido cadastrado sem criar anexo ou mensagem externa.
- [x] Marcar comprovante de endereço reconhecido com ressalvas, mantendo conferência humana; corrigir salvamento de leitura da conversa que revertia marcações recentes. Teste WhatsApp conferido após recarga: 4 de 4 recebidos. 50 testes aprovados e compilação limpa; novos recebimentos dependem de publicar esta atualização.

## Subpastas dos clientes no Google Drive — 23/10/2026
- [x] Criar 1- Start, 2- Revisao, 3- Upload e 4- Andamento processual dentro de cada pasta criada/reutilizada para o cliente.
- [x] Direcionar novos documentos do WhatsApp e do Atendimento para 1- Start, inclusive em pastas anteriores; preservar arquivos existentes.
- [x] Quatro testes aprovados; criação autenticada e leitura real das quatro subpastas de Teste WhatsApp confirmadas no Drive; compilação limpa. Destino do upload verificado com integração substituída, sem reenviar documentos existentes. Nova publicação necessária para os próximos recebimentos no site publicado.

## Análise automática de documentos — 23/10/2026
- [x] Analisar imagens/PDF recebidos pelo WhatsApp sem baixar e reenviar, preservando originais e os bloqueios jurídicos; recebimento automático verificado com integração substituída.
- [x] Persistir os dados extraídos e a marcação de itens reais do checklist, inclusive documentos-base adicionados pelo TRATO FEITO.
- [x] Análise real do RG já recebido na conversa Teste WhatsApp: extração salva e RG ou CNH marcado após recarga; lista-base recuperada (4 itens). 19 testes aprovados, incluindo incerteza, confirmação de aprovação e repetição; compilação limpa.
- [ ] Recebimento automático no WhatsApp publicado — depende de publicar esta atualização e enviar novo documento; nenhum envio externo realizado nesta verificação.

## Limpeza do atendimento fictício — 23/10/2026
- [x] Removido somente Juliana Moreira Lacerda da conta atual; exclusão confirmada e tela autenticada mostra Aguardando (0). Demais atendimentos preservados.

## Cancelamento e remarcação autorizados — 23/10/2026
- [x] Integrar Google Meet aos novos compromissos, exibir link em Consulta e histórico e incluí-lo na confirmação ao cliente. Agenda conectada confirmou suporte a Meet; criação de reunião validada com resposta substituída, sem gerar compromisso real.
- [x] Adicionar em Consulta e histórico ações humanas de cancelar/reagendar, confirmação de diligência emergencial, aviso automático com desculpas e ofertas reais de novos horários. Modal conferido na sessão autenticada; nenhum cancelamento real executado.
- [x] Consultar disponibilidade real em cada oferta; nunca oferecer simulação se a agenda falhar.
- [x] Reconhecer consulta existente, perguntar cancelar/remarcar e executar apenas com autorização explícita; validar recibo, vincular consentimento de remarcação por 30 min e impedir alterações simultâneas. Reservar novo antes de cancelar anterior e desfazer novo se cancelamento falhar.
- [x] 87 testes aprovados: disponibilidade, autorização, propriedade, rollback, ações do atendente e cinco fluxos WhatsApp com integrações substituídas; compilação limpa. Nova publicação e teste real pelo cliente ainda necessários; consultas sem recibo verificável continuam sob conferência humana.

## Agendamento 24 horas — 23/10/2026
- [x] Continuar coleta, oferta e reserva de consulta fora do expediente sem substituir por promessa de retorno da equipe; preservar limites jurídicos e pedidos humanos.
- [x] 29 testes aprovados, incluindo reserva WhatsApp às 01h06 com classificação incorreta de encaminhamento humano corrigida; compilação limpa. Integrações substituídas, sem envio ou compromisso real. Atualização depende de nova publicação.

## Conversa de agendamento — 23/10/2026
- [x] Usar telefone do remetente WhatsApp sem pedir DDD; preservar isolamento do caso vinculado.
- [x] Confirmar reserva real somente com data e horário e trocar calendário numerado por 🗓️.
- [x] 62 testes aprovados, incluindo reserva com remetente validado e persistência da consulta; compilação limpa. Integrações substituídas no teste: nenhuma mensagem externa ou compromisso real criado. Nova publicação necessária.

## WhatsApp exclusivo e acesso direto — 23/10/2026
- [x] Suprimir Telegram dos controles e bloquear sua utilização, preservando o histórico; endpoint retorna 410.
- [x] Cadastrar e liberar o número de teste informado em conversa própria “Teste WhatsApp”; vínculo relido após recarga.
- [x] Exibir acesso direto a Canal e Agente no topo da lista, inclusive sem conversa aberta; verificar fluxo autenticado, 55 testes aprovados e compilação limpa. Nova publicação necessária para disponibilizar os ajustes visuais e o bloqueio no site publicado; nenhuma mensagem externa enviada neste turno.

## Etiquetas e agenda da Ana — 23/10/2026
- [x] Etiquetas AC/RT automáticas pela mensagem de entrada, filtro e ajuste manual no Atendimento.
- [x] Agenda por carteira: novos seg–qui; cadastrados sexta 13:30–17:30; reuniões de 30 min, sem feriados nacionais. Bloqueios locais dependem de indisponibilidade no Calendar; não foi fornecida jurisdição municipal.
- [x] Coleta sem CPF no agendamento; nome/telefone reais informados pelo contato, sem herdar identidade do caso de teste.
- [x] 149 testes aprovados; compilação limpa; etiqueta RT salva, relida após recarga e filtrada na conversa autenticada. Classificação de teste restaurada. Nova reserva real não criada neste turno; compromissos anteriores preservados.
- [ ] Aviso externo à Dra. Carolina e lembrete automático às 8h com confirmação/cancelamento — depende da ativação autorizada do canal WhatsApp e de execução agendada; não simular envio real.

## Reserva automática Google Calendar — 22/10/2026
- [x] Reservar horário real escolhido inequivocamente no Telegram autorizado, revalidar disponibilidade e evitar duplicação.
- [x] Salvar confirmação e exibir compromisso real na Agenda; manter simulações separadas.
- [x] Verificar fluxo local pelo webhook assinado: consulta real criada para 23/10 às 16h–17h (Brasília), confirmada no Google Calendar e lida no Atendimento autenticado; 135 testes aprovados e compilação limpa. Compromisso de teste preservado.
- [ ] Disponibilizar no site publicado — depende de nova publicação autorizada pela usuária.

## Status das mensagens e mídias na conversa — 22/10/2026
- [x] Campo opcional `status` na mensagem (`simulada` | `enviada` | `entregue` | `lida`), sem mudança de banco (fica no JSON do caso). Regras puras `statusDoEnvio` e `avancarStatus` (não volta atrás, não promove simulada) com teste.
- [x] Gravado em todos os envios: mensagem digitada e automática, lembretes, contrato assinado, ações da etapa (`statusDoEnvio` do resultado do canal) e respostas da Ana no Telegram (`enviada`). Anexos ficam `simulada` porque `enviarAnexo` ainda é simulado.
- [x] Tiques como no WhatsApp: relógio (simulada), ✓ cinza (enviada), ✓✓ cinza (entregue), ✓✓ azul (vista), com rótulo acessível.
- [x] Imagens aparecem como foto (lidas do armazenamento privado do caso, sem alterar o original) e abrem em tela cheia; documentos abrem em prévia com Baixar e mostram tamanho; arquivos sem conteúdo guardado mostram aviso em vez de cartão quebrado.
- [ ] "Entregue" e "vista" reais — depende de recibos do canal: o Telegram Bot API não envia confirmação de entrega/leitura; o WhatsApp (UltraMsg ou API oficial) precisa de webhook de confirmação validado antes de chamar `avancarStatus`.
- Demonstração: mensagens fictícias com status variados (dados da demonstração passaram para `manager-adv-demo-db-v2`).

## Conversa no padrão do WhatsApp — 22/10/2026
- [x] Novo `src/components/office/chat-messages.tsx`: balões verde (escritório) e branco (cliente) com "rabinho" no início de cada bloco, horário dentro do balão, separadores de dia (Hoje, Ontem, dia da semana, data) só para mensagens com data real, mensagens do sistema em selo central.
- [x] Foto do cliente ao lado das mensagens dele: `ClienteAvatar` aceita foto; sem foto no cadastro/canal, usa iniciais com cor fixa por nome.
- [x] Arquivos como cartão de documento (PDF/imagem, "Salvo na pasta Start") e áudio como mensagem de voz (ondas ilustrativas; arquivo de áudio não disponível para tocar).
- [x] Classes `zap-*`. Topo e barra de digitação no cinza do WhatsApp, campo arredondado e botão de enviar redondo verde; papel de parede com contraste reduzido (imagem clareada em 42%).
- Sem "✓✓" de entregue/lida: o canal não informa esse status ao sistema.
- [x] Regras puras `rotuloDia` e `agruparMensagens` com 2 testes; 116 testes aprovados.

## Papel de parede na conversa do Atendimento — 22/10/2026
- [x] Imagem enviada pela usuária aplicada só na área das mensagens (`.attendance-messages`), repetida em blocos de 470px e parada enquanto as mensagens rolam; lista, cabeçalho, próximo passo, caixa de texto e tela vazia sem fundo.
- [x] Arquivo convertido de PNG (2,4 MB) para WebP (163 KB) em `src/assets/atendimento-wallpaper.webp`; o build gera o arquivo com hash.

## Demonstração: sugestões da IA só com a mensagem ao cliente — 22/10/2026
- [x] IA simulada (`tools/demo-navegador/legal-ai-fake.ts`) deixa de anexar "(Resposta simulada…)" nas sugestões de resposta, resumos e traduções de andamento; o aviso fica só na minuta e na auditoria (peças internas).
- [x] Sugestões conforme a situação: arquivos recebidos e documentos faltantes, áudio, demissão/trabalhista, agendamento, processo, urgência (sem afirmar aviso já feito), temas proibidos (encaminha à Dra. Carolina), saudação e agradecimento.
- Sistema real inalterado: a IA do escritório já devolve só o texto da mensagem.

## Legibilidade do Atendimento e escala de texto — 21/10/2026
- [x] Escala de texto: mínimo de 12px (`text-2xs`, horários e metadados); `text-xs` passa de 12px para 13px em todo o sistema; textos de 9–11px eliminados.
- [x] Atendimento: nomes da fila em 14px com etapa escrita (antes só um ponto colorido), filtros e "Etapas" em 13px, conversa selecionada com régua aqua; nome no topo em 16px; mensagens, dados do cliente e caixa de texto em 14px; abas Cliente/Documentos/Consulta e histórico/ProJuris em 13px com aba ativa marcada.
- [x] Clareza: faixa "Próximo passo" com botão de ação destacado; mensagens do sistema centralizadas (não parecem do cliente); sugestão da IA marcada "revise antes de enviar"; aviso "Atenção: toca em…" legível.
- [x] Horários sem segundos: `horaMensagem` (mensagens: "14:05" ou "18/10 · 14:05") e `dataHoraCurta` (registros e agenda: "10/11/2026 · 21:00") em Atendimento, Assessor, Clientes, Protocolo, Treinamento, Integrações e log do n8n; 2 testes novos.
- [x] Larguras: lista 288px e painel 340–360px; em conversa estreita o nome ganha a linha inteira e os ícones da caixa de mensagem descem (consulta por contêiner).
- [x] Verificado: 114 testes, tipos e build sem erros; Atendimento conferido em 1440, 1280, 1100 e 390 px; sem mudança de regras, permissões, banco ou integrações.

## Visual renovado com a identidade CS Lawyers — 21/10/2026
- [x] Tokens de cor: aqua da marca #00ACA7 em réguas, marcadores e foco; aqua de ação #007F7B em botões e links (contraste 4,9:1 com texto branco; antes 2,9:1); petróleo #0F3533 no menu; fundo #F4F7F7; pendências seguem #FFE600 com texto #0D0D0D.
- [x] Menu lateral em grupos (Assessor; Fluxo do caso; Cadastros; Escritório), com linha ligando as etapas do fluxo na ordem de trabalho. No celular o menu fecha ao escolher uma tela.
- [x] Cabeçalho com assinatura da marca e régua aqua de papel timbrado; títulos de página em EB Garamond sem o rótulo repetido "CS LAWYERS / OPERAÇÃO JURÍDICA".
- [x] Tela de entrada em duas colunas (painel petróleo com a marca e formulário), empilhada no celular.
- [x] Verificado: 112 testes aprovados, tipos e build sem erros, telas conferidas em 1440×900 e 390×844. Sem mudança em regras, permissões, banco ou integrações.

## Um bot Telegram para testes — 21/10/2026
- [x] Simplificar a tela para um bot, @ManagerADV2Bot; pedido de dois bots cancelado pela usuária.
- [x] Conferir contato Teste Dra. liberado e vinculado a Paulo, Ana ligada e modo Automática; webhook principal registrado no site publicado, sem pendências/erros. Teste assinado local processado, resposta enviada e lida na conversa após recarga; chamada sem assinatura recusada (401). Ana retomada ao final; 38 testes aprovados e compilação limpa.
- [ ] Publicar a atualização preparada — aguardando publicação manual pela usuária; após publicar, enviar nova mensagem ao @ManagerADV2Bot. Histórico de testes preservado, sem afirmar sessão nova.

## Agente Ana pelo Telegram — 21/10/2026
- [x] Ajustar brevidade, evitar perguntas repetidas, continuar acolhimento em temas delicados e permitir agenda fictícia claramente identificada no Telegram de teste; regras e duas respostas reais da IA verificadas sem envio externo.
- [x] Aplicar identidade enviada e regras de modos, aprovação, identificação e encaminhamento humano.
- [x] Processar mensagens do contato de teste liberado no servidor e persistir respostas/rascunhos sem depender da conversa aberta.
- [x] Ativar e verificar duas respostas reais localmente, retenção jurídica e deduplicação; integrações ProJuris/Agenda/Drive seguem indisponíveis.
- [ ] Efetivar Ana no Telegram publicado — bloqueado: publicação da atualização; a prévia pública ainda usa o webhook anterior. Webhook mantido no site publicado, sem trocar o recebimento existente.

## Atendimento por canal (Telegram) — 21/10/2026
- [x] Camada de canais (tipos, telegram, simulador, ultramsg stub) e funções puras de telefone com testes.
- [x] Tabelas atendimento_canal_config, atendimento_contatos_teste e audit_log com RLS; só sênior/admin alteram config.
- [x] enviarMensagemCanal no servidor + enviarMensagemSistema interna; n8n.ts renomeado para integracoes.ts.
- [x] Rota pública do webhook do Telegram com verificação de secret.
- [x] Aba "Canal e Agente" no Atendimento (só sênior/admin); remover campo URL n8n e modo demonstração do navegador.
- [x] Testes: telefone, canal desligado, contato não liberado, {campo} bloqueado, falha não grava, permissão, token fora de erros.

## Testes do Atendimento — próximos passos
- [ ] Fase 1: equipe testa os 5 roteiros na demonstração (`manager-adv-demonstracao.html`, gerada por `tools/demo-navegador`) e envia tempos e travamentos.
- [x] Corrigir: horários do cliente e reconhecimento sem ambiguidade.
- [x] Corrigir: registro do link HTTPS do contrato enviado fora do sistema.
- [x] Corrigir: próximo passo de cliente ativo e abertura da aba ProJuris.
- [x] Corrigir: cabeçalho e filtros no celular, incluindo área segura.
- [x] Corrigir: contraste do amarelo, apenas fundo com texto preto.
- Verificação em 21/10/2026: 70 testes aprovados e compilação limpa; busca/filtros em 390×844, 360×740 e 1440×900; aba ProJuris no celular; contrato HTTPS registrado e lido após recarga; horários enviados em demonstração sem ISO ou segundos no corpo da mensagem. Link de exemplo foi salvo no caso demonstrativo de Paulo durante o teste.
- [ ] Fase 2: sistema real no Lovable Cloud com contas da equipe e perfis em `user_roles`.
- [ ] Fase 3: ponte real com n8n (envio pelo servidor, recebimento de mensagens, simulador, workflows), UltraMsg em chip de teste, lembretes no n8n.

## Mensagens prontas no Atendimento — 20/10/2026
- [x] Sugestões da etapa acima da caixa de mensagem (aparecem com a caixa vazia): um clique coloca o texto já com o nome do cliente para revisar antes de enviar.
- [x] Botão "Mensagens prontas" com busca, categorias (Boas-vindas, Documentos, Agendamento, Processo, Geral) e prévia com os dados do cliente aberto.
- [x] Atalho "/" sem abrir janela: lista no próprio campo, setas para escolher, Enter para usar; também abre as ações da etapa.
- [x] Criar, editar, excluir e restaurar mensagens; variáveis {nome}, {nome_completo}, {documentos_faltantes}, {atendimento} e campos livres (ex.: {data}) que bloqueiam o envio até serem preenchidos.
- [x] Botão de ações da etapa separado das mensagens (ícone de lista), sem mudar handlers, permissões ou integrações.
- [x] 60 testes aprovados (7 novos), compilação sem erros; verificado no navegador em 1440×900 e 390 px.
- Limite: as mensagens criadas ficam no perfil de cada usuário (área de trabalho própria). Uma biblioteca compartilhada pelo escritório exige tabela nova e fica para uma próxima etapa.

## ProJuris no painel da conversa
- [x] Mostrar processos, andamentos, prazos, tribunal, classe, protocolo e arquivos locais do cliente selecionado em uma aba ProJuris, indicando que não houve importação real.
- [x] Verificar sessão autenticada: processos de Helena, ausência deles em Rogério, menu ProJuris, atualização e apresentação em 1424×661 e 855×661; 23 testes aprovados e compilação sem erros, sem alterar dados ou ativar integrações.
- Atualizar o ZIP somente quando os créditos estiverem no final, conforme solicitado.

## Apresentação minimalista do Atendimento
- [x] Reorganizar fila, cabeçalho, pipeline, próximo passo, mensagens e rodapé mantendo os handlers, permissões e integrações existentes.
- [x] Agrupar ações/respostas e detalhes nas três abas recolhíveis; simplificar perfis no topo e lembrar a escolha do painel localmente.
- [x] Verificar sessão autenticada em 1440×900: mensagens ocupam 681 de 836 px (81%), sete mensagens totalmente visíveis; menus, cobrança, documentos, consulta/histórico, automações, resposta rápida por barra, sugestão IA e edição verificados; 855×661 sem transbordamento e painel sem cortes; 50 testes aprovados e compilação sem erros.

## Evolução solicitada em 20/10/2026
- [x] Atendimento: fila, novas mensagens datadas, próximo passo, ações com prévia, respostas rápidas, IA por conversa, anexos e configurações de automação.
- [x] Assessor acima do painel atual, com prioridades e agenda no escopo existente.
- [x] Quadro de Produção e sincronização por etapa em Atendimento, Produção e Clientes.
- [x] Andamentos: eventos destacados e aviso revisável em linguagem simples.
- [x] Configurações: conexão n8n e log da sessão com identidade real; menu calculado e cabeçalho timbrado.
- [x] 50 testes aprovados; sessão master: resposta IA, resumo IA com checklist real, simplificação de andamento, mensagem salva após recarga, cobrança validada, horários livres, quadro, Assessor e ausência de transbordamento em 702 px; compilação sem erros.
- Limites: mensagens antigas sem ISO permanecem sem data (não inventar); lembretes simulados dependem da conversa aberta; URL n8n não conecta serviços; log é da sessão; vendedor e fora do horário estão configuráveis, mas sem fluxo externo ativado. Novos campos opcionais podem invalidar minuta pelo hash existente; nenhuma aprovação/banco foi alterada.

## Busca, clientes e Visual Law
- [x] Incluir cadastro real de cliente vinculado a caso, histórico e atualização do painel.
- [x] Criar tela de status das integrações com botões usando credenciais salvas; ZapSign e Mercado Pago verificam acesso, sem operações externas automáticas.
- [x] Criar busca rápida no cabeçalho por cliente, CPF, RG, celular, petição/processo e protocolo, respeitando acesso.
- [x] Criar Clientes com filtros e ficha de informações, processos e documentos disponíveis.
- [ ] Importar clientes, processos e documentos reais do ProJuris — bloqueado: credenciais e endereço da API do escritório.
- [x] Conferir regras visuais dos prompts e aplicar pré-visualização de peça na Produção e estilos DOCX, mantendo revisão jurídica.
- [ ] Verificar conexão ProJuris — bloqueado: autenticação e endpoint do escritório não confirmados.
- [ ] Verificar conexão UltraMsg — bloqueado: documentação exige token na URL; confirmar alternativa segura antes de usar credenciais.
- [x] Verificar cadastro e histórico após recarga, busca por RG, atualização do painel e Visual Law com conta master; 28 testes aprovados, Word gerado validado, tela de 390 px sem transbordamento.

## Preparação das integrações
- [x] Preparar contrato de integração Claude sem substituir a IA atual; modelo confirmado no catálogo, sem chamada de inferência nesta preparação.
- [x] Preparar contratos ZapSign com base em https://docs.zapsign.com.br, Mercado Pago e UltraMsg; operações reais continuam bloqueadas.
- [x] Exibir presença de credenciais e pendências em Configurações; conferir com conta master e 7 testes aprovados.
- [ ] Ativar ZapSign, Mercado Pago e UltraMsg — bloqueado: credenciais privadas e confirmação do fluxo de ativação.
- [ ] Ativar e testar inferência Claude separadamente — aguardando autorização para ativação; IA atual permanece inalterada.

- [x] Criar fila de aprovações de minutas por advogado, com prazo salvo, status da versão atual e atualização automática.
- [x] Verificar a fila autenticada, busca, prazo persistido após recarga, visualização da minuta e tela pequena sem alterar permissões de aprovação.
- [x] Exigir aprovação jurídica separada de checklist e minutas, com bloqueio de avanço e invalidação por alteração.
- [x] Verificar regras de autorização e bloqueio no atendimento, produção, auditoria e protocolo: testes de regras e tentativa real de avanço negada à atendente.
- [x] Criar painel geral de casos com status, prazos e pendências, atualização automática a cada 15 segundos e acesso conforme perfil.
- [x] Adicionar gráficos ao painel: casos em andamento por etapa, checklist concluída, prazos vencidos e pendências por categoria; verificar renderização autenticada.

- [x] Consolidar os três prompts anexados e preservar suas regras de segurança documental.
- [x] Construir Produção: checklist, arquivos privados, análise de conteúdo, cópias finais, minuta IA e exportação DOCX/memorial PDF.
- [x] Construir Auditoria: 16 categorias, relatório IA com leitura dos anexos, pendências e validação humana protegida.
- [x] Construir Protocolo: conferência final e registro externo; autuação e vínculo ProJuris demonstrativos.
- [x] Construir Andamentos: registros manuais, prazos, tarefas e avisos demonstrativos.
- [x] Construir Treinamento de IA: instruções versionadas, temas proibidos, testes reais e exemplos revisados.
- [x] Construir Configurações: perfil, permissões informativas e estado das integrações.
- [x] Verificar persistência, 11 testes, navegação autenticada, upload e respostas reais de IA; tela pequena sem transbordamento.
- [x] Preparar relatório em português com limites explícitos.

## Limites desta entrega

- Atribuição a advogado e leitura integral da nova fila aguardam uma conta com perfil jurídico; a sessão disponível tem perfil atendente e nenhum advogado cadastrado foi retornado. A fila não concede aprovação ou edição de minutas de outros usuários.
- Serviços externos e tribunal não conectados: dependem de credenciais e fluxos n8n reais; não há protocolo ou aviso real.
- Conversão/compressão, agrupamento de fotos, análise ZIP do chat e pesquisa de jurisprudência externa não automatizados nesta entrega. PDFs grandes e documentos ambíguos ficam para revisão manual.
- As aprovações estão protegidas por perfil, mas não foram exercidas com conta júnior/sênior; a conta disponível é atendente.
- Painel integral disponível à sênior e administração; demais perfis veem casos próprios. Leitura integral e aprovação positiva aguardam uma sessão desses perfis para verificação ponta a ponta; não houve alteração de cargos de usuários.
- Exportação DOCX tem cabeçalho/rodapé e margens; a reprodução integral dos modelos visuais e validação de paginação continuam fora desta etapa.
## Integração real ProJuris (aguardando credenciais)

- [ ] Cadastrar clientes/casos no ProJuris a partir do atendimento — bloqueado: credenciais de API.
- [ ] Vincular processo (CNJ) ao caso no ProJuris — bloqueado: credenciais de API.
- [ ] Enviar pacote final aprovado ao ProJuris — bloqueado: credenciais de API.
- [ ] Receber andamentos/prazos do ProJuris (webhook) em Andamentos — bloqueado: credenciais de API.

## Pacote de continuação — 22/10/2026
- [x] Gerar manager-adv-cs-lawyers_v3.zip com o estado atual do projeto para continuar em outra IA: 112 testes aprovados, compilação sem erros, sem .env nem chaves privadas.
- [x] Botões clicáveis de horário no Telegram (Ana e atendente) com reserva no Google Calendar ao clicar.
- [x] Modelos de mensagens do escritório nos atalhos e no treinamento da Ana (2 listas enviadas em 22/10).
- Trato feito: Drive, ProJuris/ZapSign, Plaud e WhatsApp da Dra. simulados até autorização e credenciais.
- Google Drive real: o TRATO FEITO cria a pasta Raiz/AC ou RT/Cliente; anexos (painel e Telegram) são copiados para ela; ProJuris/ZapSign/Plaud ainda simulados.
