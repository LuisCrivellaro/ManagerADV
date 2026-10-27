# Manager ADV — CS Lawyers | Advocacia

Sistema interno do escritório da Dra. Carolina Santos (Brasil • Dubai • Portugal). Ele acompanha o caso do primeiro contato do cliente até o andamento do processo, com revisão humana em cada etapa jurídica.

Uso exclusivo da equipe do escritório. Repositório **privado**.

## Como o projeto é mantido

| Papel | Ferramenta |
|---|---|
| Desenvolvimento do código, testes e relatórios | Claude (claude.ai) |
| Versionamento e ponte entre Claude e Lovable | GitHub (este repositório) |
| Hospedagem, backend, login, banco, arquivos, conectores Google e segredos | Lovable Cloud |
| Publicação do site | Botão **Publicar** na Lovable, somente com autorização da Dra. |

O fluxo de uma alteração é sempre este:

1. A Dra. baixa o código atual daqui (Code → Download ZIP) e anexa no Claude.
2. O Claude altera somente o necessário, roda os testes e entrega os arquivos alterados com relatório em português.
3. Os arquivos são enviados para este repositório. A Lovable sincroniza sozinha.
4. A Dra. publica na Lovable e faz o teste real.

Código no repositório não muda o site publicado. Testes com serviços simulados também não comprovam o funcionamento externo: o teste real depois da publicação continua necessário.

> **Atenção:** nunca reescreva o histórico deste repositório (force push, rebase ou amend de commits já enviados). Nunca renomeie nem apague o repositório. Isso quebra a sincronização com a Lovable.

## Módulos

| Módulo | Rota | Situação |
|---|---|---|
| Assessor de prazos (painel) | `/` | Em uso |
| Atendimento + Ana | `/atendimento` | Em teste pelo Telegram |
| Produção de petições | `/producao` | Em uso (início manual) |
| Aprovações de minutas | `/aprovacoes` | Em uso |
| Auditoria (IA + advogado) | `/auditoria` | Em uso |
| Protocolo | `/protocolo` | Protocolo em tribunal **simulado** |
| Andamentos | `/andamentos` | Registro local; sem importação externa |
| Clientes | `/clientes` | Em uso |
| Treinamento de IA | `/treinamento` | Em uso |
| Configurações | `/configuracoes` | Em uso |
| Integrações | `/integracoes` | Painel de status, somente leitura |

## Ana — assistente virtual do Atendimento

A Ana é uma assistente virtual, não advogada. Ela atende 24h, tira dúvidas gerais e cuida da agenda: oferece horários, marca, cancela e remarca a consulta inicial (online, gratuita, 30 minutos, com Google Meet).

- **IA:** Claude pela API da Anthropic, direto do servidor, com cobrança na conta de API do escritório. O modelo padrão está no código e pode ser trocado pela variável `ANA_MODELO`.
- **Identidade:** `src/lib/atendimento/ana-prompt.txt`.
- **Restrições:** `src/lib/atendimento/ana-restrictions.txt`.
- **Treinamento:** o conteúdo da tela Treinamento é acrescentado no servidor.
- **Segurança:** o Claude devolve apenas um JSON validado. Quem decide, revalida e executa qualquer ação é o servidor (`ana.server.ts`).
- **Canal:** Telegram (bot de teste) no momento. O WhatsApp pela UltraMsg está pausado, com a configuração preservada. Só um canal fica ativo por vez. A Ana só responde contatos vinculados e liberados.

### Regras de agenda

- Clientes novos: seg a qui, 9h às 17h30.
- Clientes já cadastrados: sexta, 13h30 às 17h30.
- Último início às 17h. Nunca em fins de semana ou feriados nacionais.
- A disponibilidade é conferida na agenda real antes de reservar.
- Cancelamento só depois de uma pergunta com data e hora e de uma confirmação explícita do cliente.
- Remarcação cria o novo compromisso antes de excluir o antigo, com reversão em caso de falha.

As regras completas estão em [`REGRAS-DA-DOUTORA.md`](REGRAS-DA-DOUTORA.md) e em [`docs/ana-horarios-cancelamento.md`](docs/ana-horarios-cancelamento.md).

## Integrações

| Serviço | Situação |
|---|---|
| Anthropic (Ana) | ✅ Real, no servidor |
| Lovable AI Gateway (análise jurídica, minutas, auditoria) | ✅ Real, no servidor |
| Google Agenda | ✅ Real, pelo conector da Lovable (conta da Dra.) |
| Google Drive | ✅ Real, pelo conector da Lovable (pastas 1- Start, 2- Revisao, 3- Upload, 4- Andamento processual) |
| Telegram | 🧪 Real, canal de teste temporário |
| WhatsApp (UltraMsg) | ⏸️ Implementado, **pausado** |
| ProJuris, ZapSign, Mercado Pago, JusBrasil, Plaud, protocolo em tribunal | ❌ **Não implementados.** Existem telas, contratos e marcadores simulados |

Nada simulado deve ser apresentado como importação, envio, assinatura, cobrança ou protocolo real.

## Tecnologia

- TanStack Start v1, React 19, TypeScript, Tailwind 4, Vite 8, Vitest.
- Pacotes instalados com Bun (`bun.lock`).
- Execução no Cloudflare Workers. Por isso não há módulos nativos nem processos externos: o código usa apenas Web APIs e `fetch`.
- Backend Lovable Cloud (banco com regras de acesso por proprietário, login e armazenamento privado).

## Rodar no computador

```sh
bun install --frozen-lockfile   # instala exatamente as versões do lockfile
bun run dev                     # interface de desenvolvimento
bunx vitest run                 # testes (referência: 338 testes em 44 arquivos em 27/10/2026)
bunx tsc --noEmit               # checagem de tipos
```

O sistema completo depende do backend e dos conectores da Lovable, que não funcionam fora dela.

Para ver as telas sem backend, existe uma demonstração que roda inteira no navegador, com dados fictícios e IA simulada. As instruções estão em [`tools/demo-navegador/LEIA-ME.md`](tools/demo-navegador/LEIA-ME.md).

## Estrutura principal

```
src/routes/_authenticated/     páginas protegidas pelo login
src/routes/api/public/         entradas externas (Telegram e WhatsApp), com autenticação do provedor
src/components/office/         telas e componentes do escritório
src/lib/atendimento/           Ana, agenda, canais, Calendar e Drive
src/lib/legal/                 prompts e geração de peças (Visual Law, DOCX)
src/services/                  contratos de integrações futuras
src/test/                      testes automatizados
drizzle/migrations/            migrações históricas (não reaplicar em produção)
tools/demo-navegador/          demonstração sem backend
docs/                          relatórios e guias de continuidade
```

Não crie `App.tsx`, `src/pages` nem outro roteador. Não altere os clientes do backend gerados pela Lovable.

## Configuração

Aqui ficam somente os nomes. Os valores ficam no cofre de segredos da Lovable.

| Finalidade | Variáveis |
|---|---|
| Ana | `ANTHROPIC_API_KEY`, `ANA_MODELO` (opcional) |
| Gateway, Agenda e Drive | `LOVABLE_API_KEY`, `GOOGLE_CALENDAR_API_KEY`, `GOOGLE_DRIVE_API_KEY` |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` |
| WhatsApp | `ULTRAMSG_INSTANCE_ID`, `ULTRAMSG_TOKEN`, `ULTRAMSG_WEBHOOK_SECRET` |
| Endereço público | `PUBLIC_APP_URL` |
| Futuro (deixar vazio) | `ZAPSIGN_API_TOKEN`, `MERCADOPAGO_ACCESS_TOKEN` |

Para segredos:

- Nunca coloque segredos no código, no chat ou com o prefixo `VITE_`.
- O arquivo `.env.example` contém apenas os nomes.
- As chaves dos conectores da Lovable não são tokens do Google.

## Regras que não podem ser quebradas

- Casos, checklists e área de trabalho são privados por proprietário.
- Os papéis de acesso ficam apenas em `user_roles`. Ninguém promove a si mesmo.
- Aprovação jurídica é feita por advogado e validada no servidor. Qualquer mudança no material invalida a aprovação.
- Documentos originais nunca são alterados nem apagados.
- O início da Produção é sempre manual.
- Não alterar migrações, regras de acesso do banco, prompt, modelo, contrato JSON, canal ou agenda sem pedido explícito da Dra.
- Falha ou incerteza vai para revisão humana. Nunca se inventa autorização, recibo ou disponibilidade.
- Use somente dados fictícios em testes e demonstrações.

### Leia antes de alterar qualquer coisa

- [`AGENTS.md`](AGENTS.md): decisões técnicas e o motivo de cada uma.
- [`REGRAS-DA-DOUTORA.md`](REGRAS-DA-DOUTORA.md): regras de negócio, agenda, documentos e Visual Law.
- [`CONTINUAR-NO-CLAUDE.md`](CONTINUAR-NO-CLAUDE.md): estado atual, conectores e limites de hospedagem.
- [`roadmap.md`](roadmap.md): histórico das entregas e pendências.
