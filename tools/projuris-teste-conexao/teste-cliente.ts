// Teste com o cliente de TESTE do ProJuris, só leitura. Roda no computador da Dra. Carolina (Bun):
//   bun tools/projuris-teste-conexao/teste-cliente.ts "+55 11 99999-9999"   (ou, no Mac sem o projeto: node teste-cliente-projuris.mjs)
// Usa o mesmo código do Manager ADV (src/lib/projuris): identificação pelo telefone principal, processos
// ativos como cliente e as 3 últimas movimentações não privadas. Segurança: só usa e mostra pessoas cujo nome
// começa com [TESTE]; qualquer outra pessoa é ignorada e nada dela é exibido. Credenciais: .env desta pasta.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { criarClienteProjuris, type ClienteProjuris } from '../../src/lib/projuris/cliente.server';
import { criarConsultasProjuris } from '../../src/lib/projuris/consultas.server';
import { pessoaDe, registros, totalRegistros } from '../../src/lib/projuris/mapeamento';
import { identificarPorTelefone, type PessoaComTelefones } from '../../src/lib/projuris/identificacao';
import { chaveTelefone } from '../../src/lib/projuris/telefone';
import { identificacaoProcesso, podeDetalhar } from '../../src/lib/projuris/processos';

export const PREFIXO_TESTE = '[TESTE]';
const ehTeste = (nome: string) => nome.trim().toUpperCase().startsWith(PREFIXO_TESTE);
const CHAVES_PESSOA = ['pessoaConsulta', 'pessoaConsultaCompleta', 'pessoas', 'pessoaWs'];

export async function testarCliente(telefone: string, cliente: Pick<ClienteProjuris, 'chamar'>, log: (linha: string) => void): Promise<boolean> {
  if (!chaveTelefone(telefone)) { log('Telefone inválido: informe com DDD, por exemplo "+55 11 99999-9999".'); return false; }

  const raw = await cliente.chamar('pessoa.consulta', { consulta: { 'filtro-geral': PREFIXO_TESTE, 'quan-registros': 50 } });
  const lista = registros(raw, CHAVES_PESSOA);
  log(`1. Login e busca de pessoas: OK (${lista.length} na resposta, total informado ${totalRegistros(raw, CHAVES_PESSOA)}).`);

  const candidatas: PessoaComTelefones[] = [];
  for (const r of lista) {
    const resumo = pessoaDe(r);
    if (!resumo || !ehTeste(resumo.nome)) continue; // quem não é de teste nunca é usado nem exibido
    const completa = resumo.telefones.length ? resumo : pessoaDe((await cliente.chamar('pessoa.obter', { parametros: { codigo: resumo.codigo } })) as Record<string, unknown>);
    candidatas.push(completa && ehTeste(completa.nome) ? completa : resumo);
  }
  if (!candidatas.length) {
    log(`   Nenhuma pessoa com nome começando por ${PREFIXO_TESTE}. Cadastre o cliente de teste no ProJuris.`);
    if (lista[0]) log(`   Campos de cada pessoa na resposta (só nomes, para ajuste): ${Object.keys(lista[0]).join(', ')}`);
    return false;
  }
  for (const p of candidatas) log(`   ${p.nome} · telefones: ${p.telefones.length ? p.telefones.map(t => `${t.numero}${t.principal ? ' (principal)' : ''}`).join(', ') : 'nenhum veio na resposta'}`);

  const id = identificarPorTelefone(telefone, candidatas);
  const motivo = { telefone_invalido: 'telefone inválido', nao_encontrado: 'nenhuma pessoa de teste com este telefone como principal', duplicado: 'telefone principal em mais de uma pessoa de teste' } as const;
  log(`2. Identificação pelo telefone principal: ${id.tipo === 'unico' ? `OK → ${id.pessoa.nome}` : `não identificou (${motivo[id.tipo]})`}`);
  if (id.tipo !== 'unico') return false;

  const q = criarConsultasProjuris(cliente);
  log(`3. Situação "Ativo" encontrada no ProJuris (código ${await q.codigoSituacaoAtivo()}).`);
  const processos = await q.processosAtivos(id.pessoa.codigo);
  log(`   Processos ativos em que é cliente: ${processos.length}`);
  for (const p of processos) {
    log(`   • ${identificacaoProcesso(p)}${podeDetalhar(p) ? '' : ' (segredo de justiça: não detalhado)'}`);
    if (!podeDetalhar(p)) continue;
    const andamentos = await q.ultimosAndamentos(p.codigo);
    log(andamentos.length ? andamentos.map(a => `      - ${a.data}${a.hora ? ` ${a.hora}` : ''} · ${a.tipo ?? 'sem tipo'} · ${a.descricao}`).join('\n') : '      - nenhuma movimentação pública registrada');
  }
  log('4. Concluído. Andamentos marcados como privados nunca aparecem.');
  return true;
}

/** Nomes de campos, sem valores (para confirmar o formato real da resposta). */
function nomesCampos(v: unknown, prefixo = '', profundidade = 0): string[] {
  if (profundidade > 2 || !v || typeof v !== 'object') return [];
  const obj = Array.isArray(v) ? v[0] : v;
  if (!obj || typeof obj !== 'object') return [];
  return Object.keys(obj as Record<string, unknown>).flatMap(k => [`${prefixo}${k}`, ...nomesCampos((obj as Record<string, unknown>)[k], `${prefixo}${k}.`, profundidade + 1)]);
}

/** Formato de um valor (sem mostrar o valor): ajuda a programar a leitura sem expor dados. */
function formato(v: unknown): string {
  if (v === null || v === undefined) return 'vazio';
  if (typeof v === 'number') return v > 1e11 ? 'número (milissegundos de data)' : v > 86400 ? 'número (milissegundos do dia?)' : 'número';
  if (typeof v === 'boolean') return 'sim/não';
  if (typeof v === 'string') return /^\d{4}-\d{2}-\d{2}T/.test(v) ? 'texto data e hora (ISO)' : /^\d{4}-\d{2}-\d{2}$/.test(v) ? 'texto AAAA-MM-DD' : /^\d{2}:\d{2}/.test(v) ? 'texto HH:MM' : 'texto';
  return Array.isArray(v) ? `lista (${v.length})` : 'objeto';
}

const dataLegivelMs = (v: unknown) => typeof v === 'number' && v > 1e11 ? new Date(v).toISOString().slice(0, 10) : typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined;

/** Descoberta da agenda, só leitura: contagens, situações, tipos, responsáveis (equipe) e formatos. Nada de títulos, descrições ou clientes. */
export async function descobrirAgenda(cliente: Pick<ClienteProjuris, 'chamar'>, log: (linha: string) => void, agora = new Date()): Promise<boolean> {
  const ini = new Date(agora.getTime()), fim = new Date(agora.getTime() + 21 * 86400000);
  const formatos: [string, unknown][] = [
    ['sem filtro', {}],
    ['dataInicio/dataFim (ms)', { dataInicio: ini.getTime(), dataFim: fim.getTime() }],
    ['dataInicial/dataFinal (ms)', { dataInicial: ini.getTime(), dataFinal: fim.getTime() }],
    ['dataLimiteInicio/dataLimiteFim (ms)', { dataLimiteInicio: ini.getTime(), dataLimiteFim: fim.getTime() }],
  ];
  let base: Record<string, unknown>[] | undefined;
  for (const [nome, corpo] of formatos) {
    let raw: unknown;
    try { raw = await cliente.chamar('tarefa.calendario', { corpo }); }
    catch (e) { const x = e as { tipo?: string; status?: number }; log(`   Filtro "${nome}": não aceito (${x.tipo ?? 'erro'}${x.status ? `, HTTP ${x.status}` : ''}).`); continue; }
    const grupos = registros(raw, ['tarefas', 'tarefaWs', 'tarefaCalendario', 'tarefasCalendario']);
    const tarefas = grupos.flatMap(g => { const t = g['tarefaConsultaWs']; return Array.isArray(t) ? t.filter(x => x && typeof x === 'object') as Record<string, unknown>[] : t && typeof t === 'object' ? [t as Record<string, unknown>] : []; });
    log(`   Filtro "${nome}": ${grupos.length} grupo(s), ${tarefas.length} item(ns).`);
    base ??= tarefas;
  }
  if (!base) { log('   Nenhum filtro foi aceito. Me mande estas linhas.'); return false; }
  const t = base;
  const conta = (f: (x: Record<string, unknown>) => boolean) => t.filter(f).length;
  log(`1. Itens (sem filtro): ${t.length} · compromissos: ${conta(x => x['flagTarefaCompromisso'] === true)} · dia todo: ${conta(x => x['diaTodo'] === true)} · concluídos: ${conta(x => x['flagSituacaoConcluida'] === true)}`);
  const agrupa = (f: (x: Record<string, unknown>) => string | undefined) => { const m = new Map<string, number>(); for (const x of t) { const k = f(x); if (k) m.set(k, (m.get(k) ?? 0) + 1); } return [...m].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k, n]) => `${k}: ${n}`).join(' · '); };
  log(`2. Situações: ${agrupa(x => x['situacao'] !== undefined ? `${String(x['situacao'])} (código ${String(x['codigoSituacao'] ?? '?')})` : undefined) || 'sem campo'}`);
  log(`3. Tipos de tarefa: ${agrupa(x => x['nomeTarefaTipo'] !== undefined ? `${String(x['nomeTarefaTipo'])}${x['flagTarefaCompromisso'] === true ? ' [compromisso]' : ''}` : undefined) || 'sem campo'}`);
  const responsaveis = new Map<string, number>();
  for (const x of t) {
    for (const campo of ['usuarioResponsaveis', 'dadosResponsaveis']) {
      const v = x[campo];
      for (const u of Array.isArray(v) ? v : v ? [v] : []) {
        const k = typeof u === 'object' && u ? (() => { const o = u as Record<string, unknown>; return `${String(o['valor'] ?? o['nome'] ?? o['nomeUsuario'] ?? '?')} (código ${String(o['chave'] ?? o['codigo'] ?? o['codigoUsuario'] ?? '?')})`; })() : String(u);
        responsaveis.set(`${campo}: ${k}`, (responsaveis.get(`${campo}: ${k}`) ?? 0) + 1);
      }
    }
  }
  log(`4. Responsáveis (equipe): ${[...responsaveis].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, n]) => `${k} → ${n}`).join(' · ') || 'nenhum'}`);
  const ex = (campo: string) => { const v = t.find(x => x[campo] !== null && x[campo] !== undefined)?.[campo]; return `${campo}: ${formato(v)}`; };
  log(`5. Formatos: ${['dataLimite', 'horaLimite', 'dataInicioCompromisso', 'horaInicioCompromisso', 'dataFimCompromisso', 'usuarioResponsaveis', 'dadosResponsaveis'].map(ex).join(' · ')}`);
  const resp = t.find(x => Array.isArray(x['usuarioResponsaveis']) && (x['usuarioResponsaveis'] as unknown[]).length)?.['usuarioResponsaveis'] as unknown[] | undefined;
  if (resp?.[0] && typeof resp[0] === 'object') log(`   Campos de cada responsável: ${Object.keys(resp[0] as Record<string, unknown>).join(', ')}`);
  const datas = t.map(x => dataLegivelMs(x['flagTarefaCompromisso'] === true ? x['dataInicioCompromisso'] : x['dataLimite'])).filter((d): d is string => !!d).sort();
  log(`6. Período dos itens: ${datas[0] ?? '?'} a ${datas.at(-1) ?? '?'} · a partir de hoje: ${datas.filter(d => d >= agora.toISOString().slice(0, 10)).length}`);
  return true;
}

export function lerEnv() {
  const caminho = fileURLToPath(new URL('.env', import.meta.url));
  const v: Record<string, string> = {};
  if (existsSync(caminho)) for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
    const m = /^\s*(PROJURIS_CLIENT_ID|PROJURIS_CLIENT_SECRET)\s*=\s*(.*?)\s*$/.exec(linha);
    if (m) v[m[1]!] = m[2]!.replace(/^["']|["']$/g, '');
  }
  return { clientId: (process.env['PROJURIS_CLIENT_ID'] ?? v['PROJURIS_CLIENT_ID'] ?? '').trim(), clientSecret: (process.env['PROJURIS_CLIENT_SECRET'] ?? v['PROJURIS_CLIENT_SECRET'] ?? '').trim() };
}

/** Leitura do terminal com fila: funciona digitando ou colando várias linhas de uma vez. */
let leitor: { close(): void } | undefined;
const fila: string[] = [];
let esperando: ((linha: string) => void) | undefined;
let fechado = false;
let ocultar = false;
async function perguntar(texto: string, oculto = false): Promise<string> {
  if (!leitor) {
    const { createInterface } = await import('node:readline');
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    const r = rl as unknown as { _writeToOutput: (s: string) => void };
    const original = r._writeToOutput.bind(rl);
    r._writeToOutput = (s: string) => { if (!ocultar) original(s); else if (/[\r\n]/.test(s)) original('\n'); };
    rl.on('line', linha => { if (esperando) { const f = esperando; esperando = undefined; f(linha); } else fila.push(linha); });
    rl.on('close', () => { fechado = true; if (esperando) { const f = esperando; esperando = undefined; f(''); } });
    leitor = rl;
  }
  process.stdout.write(texto);
  ocultar = oculto;
  const resposta = await new Promise<string>(resolve => {
    if (fila.length) resolve(fila.shift()!);
    else if (fechado) resolve('');
    else esperando = resolve;
  });
  ocultar = false;
  if (!process.stdin.isTTY) process.stdout.write('\n');
  return resposta.trim();
}

/** Linha de comando: usa .env ou variáveis de ambiente; se faltarem, pergunta (a chave fica oculta). */
export async function executarCli() {
  const env = lerEnv();
  const modo = process.argv[2] === 'agenda' ? 'agenda' : process.argv[2] ? 'cliente' : (await perguntar('Digite "cliente" para testar o cliente [TESTE] ou "agenda" para ler a agenda: ')).toLowerCase().startsWith('a') ? 'agenda' : 'cliente';
  const telefone = modo === 'agenda' ? '' : (process.argv[2] && process.argv[2] !== 'cliente' ? process.argv[2] : await perguntar('Telefone principal do cliente [TESTE] (com DDD): '));
  const clientId = env.clientId || await perguntar('Cole o PROJURIS_CLIENT_ID e aperte Enter: ');
  const clientSecret = env.clientSecret || await perguntar('Cole o PROJURIS_CLIENT_SECRET e aperte Enter (não aparece na tela): ', true);
  leitor?.close();
  if (!clientId || !clientSecret) { console.log('Faltam as credenciais do ProJuris.'); process.exit(2); }
  console.log('');
  const cliente = criarClienteProjuris({ credenciais: () => ({ clientId, clientSecret }) });
  try {
    const ok = modo === 'agenda' ? await descobrirAgenda(cliente, l => console.log(l)) : await testarCliente(telefone, cliente, l => console.log(l));
    process.exit(ok ? 0 : 1);
  } catch (e) {
    const x = e as { tipo?: string; status?: number; message?: string };
    console.log(`Falhou: ${x.tipo ?? 'erro'}${x.status ? ` (HTTP ${x.status})` : ''} · ${x.message ?? ''}`);
    process.exit(1);
  }
}

if ((import.meta as { main?: boolean }).main) void executarCli();
