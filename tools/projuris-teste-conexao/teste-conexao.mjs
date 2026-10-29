#!/usr/bin/env node
// Teste de conexão com o ProJuris ADV, só leitura. Roda no computador da Dra. Carolina (Node 18 ou mais novo).
// Lê PROJURIS_CLIENT_ID e PROJURIS_CLIENT_SECRET do ambiente ou de um arquivo .env nesta pasta.
// Imprime só: se funcionou, o status HTTP, o total de registros e o formato de autorização aceito.
// Nunca imprime a chave, o token nem dados de pessoas. Com --estrutura, mostra só os NOMES dos campos.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const URL_AUTENTICACAO = 'https://apigw.projurisadv.com.br/auth/token';
const URL_PESSOAS = 'https://api.projurisadv.com.br/adv-service/pessoa/consulta?quan-registros=1';

function lerEnv() {
  const caminho = fileURLToPath(new URL('.env', import.meta.url));
  const valores = {};
  if (existsSync(caminho)) {
    for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(PROJURIS_CLIENT_ID|PROJURIS_CLIENT_SECRET)\s*=\s*(.*?)\s*$/.exec(linha);
      if (m) valores[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return {
    clientId: (process.env.PROJURIS_CLIENT_ID ?? valores.PROJURIS_CLIENT_ID ?? '').trim(),
    clientSecret: (process.env.PROJURIS_CLIENT_SECRET ?? valores.PROJURIS_CLIENT_SECRET ?? '').trim(),
  };
}

/** Só os nomes dos campos, sem nenhum valor. */
function estrutura(v, recuo = '  ', profundidade = 0) {
  if (profundidade > 5) return [];
  if (Array.isArray(v)) return v.length ? [`${recuo}[lista]`, ...estrutura(v[0], recuo + '  ', profundidade + 1)] : [`${recuo}[lista vazia]`];
  if (v && typeof v === 'object') return Object.keys(v).flatMap(k => [`${recuo}${k}`, ...estrutura(v[k], recuo + '  ', profundidade + 1)]);
  return [];
}

async function principal() {
  const { clientId, clientSecret } = lerEnv();
  if (!clientId || !clientSecret) {
    console.log('Faltam PROJURIS_CLIENT_ID e/ou PROJURIS_CLIENT_SECRET no arquivo .env desta pasta.');
    process.exit(2);
  }

  const auth = await fetch(URL_AUTENTICACAO, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }).toString(),
    signal: AbortSignal.timeout(15000),
  }).catch(() => undefined);
  if (!auth) { console.log('1. Autenticação: falhou (sem resposta do ProJuris).'); process.exit(1); }
  const corpo = await auth.json().catch(() => undefined);
  const token = typeof corpo?.access_token === 'string' ? corpo.access_token : '';
  if (!auth.ok || !token) { console.log(`1. Autenticação: falhou (HTTP ${auth.status}).`); process.exit(1); }
  console.log(`1. Autenticação: OK (HTTP ${auth.status}).`);

  const esquema = typeof corpo.token_type === 'string' && corpo.token_type.trim() ? corpo.token_type.trim() : 'Bearer';
  const formatos = [[`${esquema} <token>`, `${esquema} ${token}`], ['só o token, sem prefixo', token]];
  for (const [nome, valor] of formatos) {
    const r = await fetch(URL_PESSOAS, {
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: valor },
      signal: AbortSignal.timeout(15000),
    }).catch(() => undefined);
    if (!r) { console.log('2. Consulta de pessoas: falhou (sem resposta do ProJuris).'); process.exit(1); }
    if (r.status === 401) continue;
    const dados = await r.json().catch(() => undefined);
    const total = typeof dados?.totalRegistros === 'number' ? dados.totalRegistros : Array.isArray(dados) ? dados.length : 'não informado';
    console.log(`2. Consulta de pessoas: ${r.ok ? 'OK' : 'falhou'} (HTTP ${r.status}) · total de registros: ${r.ok ? total : '-'}`);
    if (r.ok) console.log(`3. Formato de autorização aceito: ${nome}.`);
    if (r.ok && process.argv.includes('--estrutura')) console.log(['Campos da resposta (só nomes, sem valores):', ...estrutura(dados)].join('\n'));
    process.exit(r.ok ? 0 : 1);
  }
  console.log('2. Consulta de pessoas: falhou (HTTP 401 nos dois formatos de autorização).');
  process.exit(1);
}

principal();
