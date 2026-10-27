# Demonstração no navegador

Gera uma versão do Manager ADV que roda **inteira no navegador**, sem Supabase,
sem servidor e sem chaves. Serve para mostrar o sistema e para a fase 1 de
testes (fluxo do Atendimento com dados fictícios).

O que muda em relação ao sistema real (só nesta demonstração):

- `supabase-fake.ts` — banco e login falsos; os dados ficam no navegador de
  quem usa (botão "Restaurar dados" volta ao início). Casos de `seed.json`
  (os mesmos 5 casos fictícios da migração `0000`).
- `start-shim.ts` — as "server functions" rodam no próprio navegador, passando
  pelos mesmos middlewares e validações.
- `legal-ai-fake.ts`, `ai-fake.ts`, `openai-fake.ts` — IA simulada; os prompts
  jurídicos internos **não** entram na demonstração.
- `lovable-auth-fake.ts` — "Entrar com Google/Lovable" entra direto.
- Integrações (n8n, WhatsApp, ZapSign…) continuam simuladas como no sistema.

Nada aqui é usado pelo sistema real; o código do app (`src/`) não muda.

## Como gerar

Na raiz do projeto, com as dependências instaladas:

```sh
npm i --no-save vite-plugin-singlefile
npx vite build --config tools/demo-navegador/vite.spa.config.ts
```

O resultado é um único arquivo: `tools/demo-navegador/dist/index.html`.
Abra no navegador ou publique como página. Para testar localmente:

```sh
npx vite --config tools/demo-navegador/vite.spa.config.ts
```
