# Manager ADV — passagem para o Claude

Estado do código: 27/10/2026, após os ajustes de horários e cancelamento da Ana. Este documento prevalece sobre descrições históricas de integrações e datas no roadmap. Não é uma migração de hospedagem nem uma exportação dos dados salvos.

## 1. O que a Dra. deve entregar ao Claude

1. O ZIP desta entrega, descompactado como projeto, ou anexado se o Claude aceitar ZIP. Se a ferramenta não abrir ZIP, use Claude Code na pasta descompactada ou envie os arquivos solicitados por ele.
2. Este documento, `AGENTS.md`, as regras em `REGRAS-DA-DOUTORA.md` no pacote e o relatório `docs/ana-horarios-cancelamento.md`.
3. O próximo pedido específico. O objetivo imediato é testar o atendimento de agendamento; ZapSign, Mercado Pago, ProJuris e demais integrações futuras não precisam ser implementadas agora.
4. A decisão sobre onde o projeto continuará rodando: continuar editando fora e devolver o código à Lovable, ou planejar hospedagem independente. O ZIP sozinho não transporta os serviços hospedados.
5. Para testar, informar o bot `@ManagerADV2Bot`, conversa `Teste WhatsApp`, contato de teste já liberado e conta Google correta: `chamanalei@gmail.com`. Não enviar senha, token ou dados de clientes pelo chat.
6. Somente se houver outro ambiente: cadastrar as próprias credenciais no cofre de segredos do destino. Os nomes estão na seção 5 e no `.env.example` do pacote; os valores não estão incluídos e alguns valores gerenciados não são exportáveis.
7. Se quiser transportar dados reais, solicitar separadamente um plano de exportação/importação de registros, usuários e documentos privados, com autorização e proteção de dados. Não mandar todos os dados jurídicos ao Claude para simplesmente iniciar a edição.

Os anexos originais enviados em conversas anteriores não são todos reconstruíveis pelo ZIP. O pacote inclui os prompts e regras atualmente incorporados no código e uma cópia do último pedido de horários/cancelamento. Se algum modelo original adicional for indispensável, a Dra. deverá fornecê-lo novamente.

## 2. Mensagem para copiar e enviar ao Claude

> Continue o Manager ADV da CS Lawyers a partir deste ZIP de 27/10/2026. Primeiro leia CONTINUAR-NO-CLAUDE.md, AGENTS.md, REGRAS-DA-DOUTORA.md e docs/ana-horarios-cancelamento.md, depois examine o código. Preserve telas, dados por proprietário, aprovações jurídicas, documentos originais, Claude direto para a Ana e as regras atuais de agendamento. Não troque prompt, modelo, contrato JSON, canal, agenda, regras de acesso ou banco sem meu pedido. Telegram é o teste temporário em Teste WhatsApp; UltraMsg permanece pausado até eu autorizar. Google Calendar e Drive da conta chamanalei@gmail.com devem continuar conectados, com chamadas somente pelo servidor. Não invente chaves nem confunda chaves dos conectores com tokens do Google. Não trate o código como backup dos dados hospedados. Primeiro apresente o estado encontrado, as dependências para rodar neste ambiente e os bloqueios reais, sem ativar integrações ou enviar mensagens. Depois execute somente meu próximo pedido, rode os testes pertinentes e entregue o projeto atualizado sem segredos, com relatório em português e arquivos alterados. A última execução disponível passou 338 testes em 44 arquivos; o fluxo externo das últimas alterações ainda precisa de publicação e teste real. Não declare esse fluxo verificado apenas com serviços simulados.

## 3. Estado atual e próximos passos

- Ana utiliza **API Anthropic diretamente** pelo adaptador `claudeComoSample`; cobrança na conta de API Anthropic, não créditos Lovable para a inferência da Ana. Uma assinatura de chat Claude não substitui saldo/créditos de API Anthropic.
- A análise documental/jurídica do restante do escritório continua no Lovable AI Gateway; não trocar essa parte automaticamente e não dizer que toda IA foi migrada para Anthropic.
- Modelo padrão no código do adaptador: `claude-haiku-5-5`; `ANA_MODELO` pode sobrescrever. Isso é a configuração observada no código, não garantia de disponibilidade de modelo em outra conta/ambiente. Preservar; eventual erro deve ser investigado, sem fallback silencioso ou troca de modelo não autorizada.
- Identidade ativa: `src/lib/atendimento/ana-prompt.txt`. Restrições: `ana-restrictions.txt`. Treinamento do proprietário é acrescentado no servidor. O `prompt.ts` do pacote `src/lib/ana-claude/` não é a identidade ativa neste fluxo.
- Claude devolve o JSON validado por `anaSchema`; **não executa livremente operações externas**. `ana.server.ts` decide, revalida, executa e persiste.
- Telegram é o canal temporário; UltraMsg da doutora permanece pausado, mantendo as credenciais e a configuração. Um único canal deve estar ativo.
- Última execução nesta entrega: **338 testes aprovados / 44 arquivos**; compilação automática sem erros. Atendimento e Teste WhatsApp abertos com login, sem erros de página. Não foram criados eventos nem enviadas mensagens externas nesta validação.
- Últimas alterações de horários e cancelamento estão no código exportado, **não confirmadas no Telegram publicado**. Publicar exige autorização; depois a Dra. envia uma mensagem real e confirma o resultado na conversa e na agenda.
- Histórico da conversa foi preservado, não reiniciado nesta entrega. Mensagens antigas continuam com textos antigos e não comprovam qual código recebeu a mensagem atual.
- Cancelamento exige uma pergunta enviada com data/hora e resposta explícita posterior, vinculada ao evento, cliente e prazo. Desistência mantém a consulta; falhas vão para equipe sem dizer que cancelou. Remarcação cria o novo antes de excluir o antigo, com rollback em falha.
- Ofertas consultam disponibilidade atual, guardam todo o histórico, não repetem sem pedido explícito, preferem dias novos e misturam períodos; frustração com horários é novas opções, não reclamação jurídica.

### Pontos técnicos a avaliar antes de produção ampla
- O fluxo real automático ainda usa a condição `modo_teste` mais contato liberado. Não remover essa barreira apenas para publicar ou voltar ao UltraMsg; a liberação geral de clientes é a última etapa, depende de pedido explícito e testes.
- Operações Calendar e salvamento no atendimento não formam uma transação única. Avaliar recuperação em falha de persistência depois de uma operação externa, preservando recibos/idempotência e sem recriar/cancelar compromissos cegamente.
- Cancelamento retorna `ausente` em 404/410: indica evento ausente na agenda conectada, não prova que um evento em outra conta foi excluído. A equipe deve conferir outras agendas se houve troca de conta. Não apagar eventos em outras contas automaticamente.
- Credenciais presentes, testes com serviços substituídos e interface com link não comprovam sucesso externo. Verificar evento/recibo do cliente após publicação.

## 4. Conectores e integrações que devem existir

### Google Calendar — obrigatório para agendamento real
- Conector Lovable `google_calendar`, OAuth da conta da doutora. A conexão **Dra.'s Google Calendar (2)** está vinculada; a (1) não está. Não escolher pelo nome apenas: já houve erro por usar conta diferente.
- Conta correta anteriormente verificada: `chamanalei@gmail.com`. Consultas usam a agenda principal. Antes de migrar/religar, confirmar a conta por leitura autorizada, sem criar evento de teste não solicitado.
- Variáveis server-only: `LOVABLE_API_KEY` e `GOOGLE_CALENDAR_API_KEY`.
- Base usada: `https://connector-gateway.lovable.dev/google_calendar/calendar/v3`. Cabeçalhos `Authorization: Bearer <LOVABLE_API_KEY>` e `X-Connection-Api-Key: <GOOGLE_CALENDAR_API_KEY>`.
- A chave do conector **não é** uma chave Google nem token OAuth: não enviá-la diretamente a `googleapis.com`; refresh OAuth é gerenciado pela conexão.
- Leitura de disponibilidade, eventos com propriedade privada da conversa, reserva, cancelamento e remarcação. Google Meet é solicitado como conferência do evento; só mostrar URL HTTPS realmente retornada, não inventar link. Cancelamento usa `sendUpdates=all` para notificar convidados existentes.
- Datas all-day são início inclusivo/fim exclusivo, sem deslocamento por timezone; eventos com hora mantêm timestamps/offsets reais. Regras e exibição em `America/Sao_Paulo`.

### Google Drive — obrigatório para organização documental real
- Conector Lovable `google_drive`, OAuth da mesma conta. A conexão **Dra.'s Google Drive (2)** está vinculada; a (1) não está.
- Variáveis server-only: `LOVABLE_API_KEY` e `GOOGLE_DRIVE_API_KEY`; transporte pelo Lovable connector gateway conforme `google-drive.server.ts`.
- Escopos documentados na autorização anterior: `drive.file`, `drive.appdata` e `drive.readonly`. A lista de arquivos existentes e alterações permitidas dependem desses escopos: leitura não implica permissão de editar arquivos antigos. Confirmar autorização antes de assumir acesso a uma pasta externa.
- Pastas do cliente: `1- Start`, `2- Revisao`, `3- Upload`, `4- Andamento processual`, com categorias AC/RT. Novos documentos entram em Start. Originais intactos; cópia PDF nomeada por conteúdo, descrição/tipo específicos e deduplicação por hash. WEBP sem conversão automática gera pendência.
- Organização Drive fica no sistema/análise documental, **não no prompt da Ana**.

### Telegram — teste temporário
- Bot `@ManagerADV2Bot`; conversa Teste WhatsApp. Contato precisa estar vinculado e liberado. Webhook público protegido por `TELEGRAM_WEBHOOK_SECRET`; não trocar webhook para um host novo enquanto o código não estiver pronto e isso não for autorizado.
- Há também uma conexão Lovable **Dra.'s Telegram** vinculada. Importante: o caminho atual do app usa **`TELEGRAM_BOT_TOKEN` diretamente**, não essa conexão via gateway. A conexão vinculada não substitui automaticamente a variável do bot.
- Não implementar segundo bot: referências `_2` são compatibilidade histórica.

### UltraMsg WhatsApp — real em código, pausado
- `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`, `ULTRAMSG_WEBHOOK_SECRET`.
- Envio/entrada pelo servidor; recibos, contatos liberados, vínculo de conversa, validação da instância e segredo. Não habilitar junto ao Telegram nem alterar número de produção sem autorização.
- Nem toda operação apresentada pelo app é real: anexos de ações gerais e automações demonstrativas devem ser conferidos no código antes de prometer envio; recebimento documental real segue fluxo próprio.

### IA e demais serviços
- Anthropic: essencial para Ana, `ANTHROPIC_API_KEY`, diretamente no servidor.
- Lovable AI Gateway: documentos, minutas/auditorias/treinamento jurídico, `LOVABLE_API_KEY`, server-only.
- ProJuris, ZapSign, Mercado Pago, Plaud, Jusbrasil e protocolo de tribunal: **não implementados como fluxos externos completos**. Podem existir contratos, telas, sondagens de credenciais e marcadores locais. Não dizer que importar, assinar, pagar ou protocolar é real. ZapSign/Mercado Pago têm variáveis previstas, não são necessários para o teste de agenda atual.
- n8n não é requisito executável do atendimento atual; ações de demonstração não são workflows externos reais.
- MCP do app em `/mcp`: ferramentas somente de leitura `listar_casos` e `ver_checklist_caso`, com OAuth do usuário e escopo de acesso. Não é acesso ao código, não substitui Google Drive/Calendar e não permite editar aprovações. Uso opcional pelo Claude depende de suporte do cliente e teste do OAuth/endpoint publicado; não foi validado nesta exportação.

## 5. Configuração: nomes, não valores

O `.env.example` do ZIP só contém campos vazios. Segredos de servidor nunca usam prefixo `VITE_`.

| Finalidade | Nomes usados | Observação |
|---|---|---|
| Configuração pública do backend | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | Nomes literais exigidos pelo código gerado; não são dados exportados neste pacote |
| Backend no servidor | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` | Compatibilidade do destino deve ser verificada |
| Cliente privilegiado | `SUPABASE_SERVICE_ROLE_KEY` | Usado internamente pelo host; não é fornecido/exportável no Lovable Cloud; não pedir à Dra. nem fabricar valor |
| Migrações de ambiente próprio | `LOVABLE_DB_MIGRATION_URL` | Somente se disponibilizado no ambiente de destino; não pedir senha do Cloud nem executar migrações automaticamente |
| Ana | `ANTHROPIC_API_KEY`, `ANA_MODELO` opcional | API Anthropic, não assinatura Claude Chat |
| Calendar/Drive/Gateway jurídico | `LOVABLE_API_KEY`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_DRIVE_API_KEY` | Segredos gerenciados, não contidos no ZIP; não prometer exportação/reutilização externa |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Bot único; campos `_2` históricos não necessários |
| WhatsApp | `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`, `ULTRAMSG_WEBHOOK_SECRET` | Configurar somente no servidor; manter canal pausado |
| URL pública | `PUBLIC_APP_URL` | Base de webhook do destino, HTTPS público; não trocar sem autorização |
| Futuro | `ZAPSIGN_API_TOKEN`, `MERCADOPAGO_ACCESS_TOKEN` | Deixar vazios enquanto inativos |

Outros adaptadores paralelos têm campos próprios, como `ANA_CONVITE_EMAIL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` e `GOOGLE_CALENDAR_ID`. Não são necessários para a agenda ativa via conector. Não ativar o motor paralelo só porque ele veio no pacote.

## 6. Continuar na Lovable ou mudar hospedagem

**Editar no Claude e devolver o código à Lovable:** mantém serviços existentes quando aplicado ao mesmo projeto; devolver somente fonte/configuração alterada, nunca `.git`, `node_modules`, saídas de build ou segredos. Preferir alterações pequenas com relatório. Código atualizado não altera automaticamente o site publicado; publicar após autorização e validação.

**Hospedagem independente:** primeiro planejar compatibilidade e configurações. As conexões OAuth Lovable, backend, autenticação social broker, MCP OAuth, segredos gerenciados e URLs de mídia não viajam no ZIP. Não há garantia verificada de reuso das chaves dos conectores ou do pacote `@lovable.dev/vite-tanstack-config` em outro host. Se não houver transporte autorizado no destino, será necessário projetar integração Google própria/compatível e backend próprio, preservando os limites de segurança; isso é uma tarefa nova que exige consentimento, não uma mudança automática nesta exportação. A credencial privilegiada e senha do banco do Cloud não são fornecidas à Dra.

O ZIP contém migrações SQL históricas, tipos e modelos de demonstração, **não** um dump de contas, casos, checklist, agenda, treinamento salvo por usuário ou documentos privados. Não reaplicar migrações sobre produção; conferir esquema/versões e restauração autorizada primeiro. Valores de configuração do projeto hospedado e metadados privados da Lovable foram excluídos.

## 7. Arquitetura e pontos de entrada

- Stack real deste snapshot: TanStack Start v1, React 19.2, Vite **8.1.5** declarado no `package.json`, Tailwind 4, TypeScript, Vitest. Documentação antiga menciona Vite 7; prevalecem manifest/lock atuais.
- `bun.lock` incluído; instalar com `bun install --frozen-lockfile`, sem upgrade arbitrário.
- `bun run dev`; `bunx vitest run` (ou `bun run test`); `bun run lint`; `bun run build` somente no ambiente independente quando apropriado. Nesta entrega não houve build manual: a Lovable validou automaticamente.
- `vite.config.ts`: plugin Lovable agrega TanStack, React, Tailwind, alias e alvo Cloudflare, mais plugin MCP. Não duplicar plugins.
- `src/router.tsx`, `src/start.ts`, `src/server.ts`, `src/routes/__root.tsx`: bootstrap e fronteiras. Não criar `App.tsx`, `src/pages` ou outro router. A rota `/` atual é `src/routes/_authenticated/index.tsx`, sem placeholder.
- `src/routes/_authenticated/`: páginas protegidas pelo login client-only existente. Funções precisam validar autenticação por conta própria; gate da página não é permissão de API.
- `src/lib/atendimento/ana.functions.ts`: inferência ativa; `ana.server.ts`: orquestração; `ana-scheduling.ts`, `ana-rules.ts`, `appointment-management.ts`, `calendar-booking.ts`, `schedule-rules.ts`: regras/testes.
- `google-calendar.server.ts`, `google-drive.server.ts`: serviços reais; `envio.functions.ts` e `canais/`: envio centralizado.
- Entradas externas: `src/routes/api/public/atendimento/telegram.ts` e `whatsapp.ts`; requerem autenticação do provedor antes de trabalho privilegiado.
- `src/lib/documentos.functions.ts`: análise privada; `src/lib/legal/prompts/organizacao-drive.txt`: orientação Drive do sistema; `src/lib/respostas-prontas.ts`: textos oficiais; `quick-reply-calendar.*`: preenchimento read-only/manual pela equipe.
- Cloudflare workerd, não Node completo: sem processos externos, sharp/canvas/puppeteer, módulos nativos ou resolução de pacotes em runtime. Usar Web APIs, módulos puros e fetch; tudo deve ser bundled. SSR avalia imports: browser-only só após hidratação/import dinâmico seguro. Segredos só no servidor.
- Clientes backend gerados, tipos e configs gerenciados não devem ser reescritos na Lovable. Código privilegiado deve ser carregado só após verificar caller; jamais usar privilégio para contornar owner-scoped reads.

## 8. Não quebrar e como testar

Leia `AGENTS.md` e `REGRAS-DA-DOUTORA.md`. Casos/checklist/workspace por proprietário, roles em `user_roles`, aprovação por revisão de material, não autoaprovação, originais append-only e Produção manual são requisitos permanentes. Não mudar migrações, RLS ou funções do banco sem pedido explícito. Falhas, incerteza e temas jurídicos exigem revisão humana, não autorização inventada.

Novos: seg–qui, 09h–17h30. Cadastrados: sexta, 13h30–17h30. Duração 30 min; último início 17h; sem fins de semana/feriados nacionais. Disponibilidade real revalidada antes de reservar. Nome no máximo uma vez a cada três mensagens; escolhas por dia/hora inequívocos e ordem são aceitas.

Sequência de teste externo **só com autorização**: publicar → mensagem real ao bot → interesse em consulta/nome conforme estado → oferta verificada → escolha → evento/Meet/recibo no atendimento → pedir cancelar → confirmar → evento e consulta retirados. Testar desistência e remarcação separadamente. Não agir como se fosse o cliente, não apagar outros eventos e não reiniciar conversa sem pedido.

Os 338 testes incluem confirmações nos dois canais e ordem de operações Calendar com fetch substituído. Isso não substitui o teste externo acima. Manter o número de testes como evidência desta execução, não promessa eterna; cada mudança futura exige nova execução e resultado real.