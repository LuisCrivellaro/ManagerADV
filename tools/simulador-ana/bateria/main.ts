// Tela da bateria de testes da Ana. "Executar todos os testes" roda os cenários; "Executar só os que falharam"
// repete o que não passou. Modo "Ana real": Claude pela página (Ana, redação e avaliador). Modo "Regressão rápida":
// sem modelo, só servidor e regras. Resultados ficam salvos na página (o Claude lê daqui para corrigir).
import identidadeOriginal from '@/lib/atendimento/ana-prompt.txt?raw';
import restricoesOriginal from '@/lib/atendimento/ana-restrictions.txt?raw';
import redacaoOriginal from '@/lib/atendimento/ana-redacao-processo.txt?raw';
import { anaSchema } from '@/lib/atendimento/ana-rules';
import type { EntradaRedacao } from '@/lib/atendimento/consulta-processo';
import type { Gerador } from '../engine';
import { CENARIOS, type Cenario } from './cenarios';
import { executarCenario, type ModoExecucao, type ResultadoCenario } from './executor';
import { CRITERIOS, NOMES_CATEGORIA, type Categoria } from './avaliacao';
import { TREINO_BATERIA } from './treino';

type SampleFn = (input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; modelApplied?: string }>;
type Snap = { id: string; data(): Record<string, unknown> | undefined };
type Db = {
  doc(p: string): { set(d: Record<string, unknown>): Promise<unknown> };
  collection(p: string): { orderBy(f: string, d?: string): { limit(n: number): { onSnapshot(fn: (s: { docs: Snap[] }) => void, err?: (e: unknown) => void): () => void } } };
};
declare global { interface Window { claude?: { use(name: string): Promise<unknown> } } }

const MODELO_ANA = 'claude-haiku-5-5';
let sample: SampleFn | null = null;
let db: Db | null = null;

function lerJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/g, '').trim();
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('Resposta sem JSON.');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

/** Mesma montagem de gerarRespostaAna (ana.functions.ts) e do simulador. */
const gerarAna: Gerador = async (contexto, instrucoes, signal) => {
  if (!sample) throw new Error('Claude indisponível nesta visualização.');
  const input = [
    { role: 'user', content: `${identidadeOriginal}\n\n${restricoesOriginal}\n${instrucoes}\n\nResponda somente com um objeto JSON válido neste schema: ${JSON.stringify(anaSchema.toJSONSchema())}. Não execute ferramentas; as operações são validadas pelo servidor.` },
    { role: 'user', content: JSON.stringify(contexto) },
  ];
  const opts = { model: MODELO_ANA, modelTier: 'quick', cache: false, ...(signal ? { signal } : {}) };
  let res = await sample(input, opts);
  let obj: unknown;
  try { obj = lerJson(res.text); } catch {
    res = await sample([...input, { role: 'assistant', content: res.text || '(vazio)' }, { role: 'user', content: 'Responda de novo, só com o objeto JSON pedido.' }], opts);
    obj = lerJson(res.text);
  }
  const p = anaSchema.safeParse(obj);
  if (!p.success) throw new Error(`JSON fora do contrato da Ana: ${p.error.issues.slice(0, 2).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return { resultado: p.data, bruto: res.text, modelo: res.modelApplied };
};
const redigir = async (e: EntradaRedacao) => {
  if (!sample) throw new Error('Claude indisponível.');
  return (await sample([{ role: 'user', content: `${identidadeOriginal}\n\n${redacaoOriginal}` }, { role: 'user', content: JSON.stringify({ fatos: e }) }], { model: MODELO_ANA, modelTier: 'quick', cache: false })).text;
};
const avaliar = async (prompt: string) => {
  if (!sample) throw new Error('Claude indisponível.');
  return (await sample([{ role: 'user', content: prompt }], { cache: false })).text;
};

// ---------- Estado ----------
const resultados = new Map<string, ResultadoCenario>();
let modo: 'modelo' | 'regressao' = 'modelo';
let rodando = false;
let ctrl: AbortController | null = null;
let progresso = '';
let filtroStatus = 'todos', filtroBloco = 'todos';
const abertos = new Set<string>();

async function salvar(r: ResultadoCenario) {
  const dados = JSON.parse(JSON.stringify(r)) as Record<string, unknown>;
  if (db) { try { await db.doc(`bateria/${r.id}`).set(dados); return; } catch { /* usa o navegador */ } }
  try { const todos = JSON.parse(localStorage.getItem('bateria-ana') ?? '{}') as Record<string, unknown>; todos[r.id] = dados; localStorage.setItem('bateria-ana', JSON.stringify(todos)); } catch { /* sem armazenamento */ }
}
function carregarLocal() {
  try { for (const [id, r] of Object.entries(JSON.parse(localStorage.getItem('bateria-ana') ?? '{}') as Record<string, ResultadoCenario>)) resultados.set(id, r); } catch { /* vazio */ }
}

function falhaExecucao(c: Cenario, erro: unknown): ResultadoCenario {
  return { id: c.id, titulo: c.titulo, bloco: c.bloco, modo, status: 'FALHOU', motivo: `A execução parou: ${(erro as Error).message ?? String(erro)}`, categorias: ['integracao'], mensagensCliente: [], respostasAna: [], acoes: [], ferramentas: [], intencoes: [], verificacoes: [], transcricao: [], ms: 0, em: new Date().toISOString() };
}

async function executar(lista: Cenario[]) {
  if (rodando || !lista.length) return;
  if (modo === 'modelo' && !sample) { progresso = 'O Claude não está liberado nesta página. Recarregue e permita o uso, ou use a regressão rápida.'; render(); return; }
  rodando = true; ctrl = new AbortController();
  const m: ModoExecucao = modo === 'modelo'
    ? { tipo: 'modelo', treino: TREINO_BATERIA, gerar: gerarAna, redigir, avaliar, signal: ctrl.signal }
    : { tipo: 'regressao', treino: TREINO_BATERIA, signal: ctrl.signal };
  for (const [i, c] of lista.entries()) {
    if (ctrl.signal.aborted) break;
    progresso = `Executando ${i + 1} de ${lista.length}: ${c.id} · ${c.titulo}`;
    render();
    let r: ResultadoCenario;
    try { r = await executarCenario(c, m); } catch (erro) { r = falhaExecucao(c, erro); }
    resultados.set(c.id, r);
    await salvar(r);
    render();
  }
  progresso = ctrl.signal.aborted ? 'Interrompido.' : `Concluído: ${lista.length} cenário(s).`;
  rodando = false; ctrl = null; render();
}

// ---------- Relatório ----------
const classe = (s?: string) => s === 'PARCIALMENTE APROVADO' ? 'PARCIAL' : s ?? 'NAO';
function relatorio(): string {
  const linhas = CENARIOS.map(c => { const r = resultados.get(c.id); return `| ${c.id} | ${c.titulo} | ${c.esperado} | ${r ? r.motivo.replace(/\|/g, '/').slice(0, 220) : 'não executado'} | ${r?.status ?? '—'} |`; });
  const cont = (s: string) => [...resultados.values()].filter(r => r.status === s).length;
  return [`# Bateria de testes da Ana — ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`, '',
    `PASSOU: ${cont('PASSOU')} · PARCIALMENTE APROVADO: ${cont('PARCIALMENTE APROVADO')} · FALHOU: ${cont('FALHOU')} · não executados: ${CENARIOS.length - resultados.size}`, '',
    '| Cenário | O que foi testado | Resultado esperado | Resultado obtido | Status |', '|---|---|---|---|---|', ...linhas].join('\n');
}

// ---------- Interface ----------
const app = document.getElementById('app')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, texto?: string) { const e = document.createElement(tag); if (cls) e.className = cls; if (texto !== undefined) e.textContent = texto; return e; }
function botao(texto: string, fn: () => void, cls = '', desabilitado = false) { const b = el('button', cls, texto); b.disabled = desabilitado; b.onclick = fn; return b; }
function dl(pares: [string, string][]) { const d = el('dl'); for (const [k, v] of pares) { d.append(el('dt', '', k), el('dd', '', v)); } return d; }

function render() {
  app.replaceChildren();
  const falhados = CENARIOS.filter(c => { const r = resultados.get(c.id); return r && r.status !== 'PASSOU'; });
  const p = el('section', 'painel');
  const seg = el('div', 'seg');
  for (const [k, nome] of [['modelo', 'Ana real (Claude)'], ['regressao', 'Regressão rápida (sem modelo)']] as const) {
    const b = botao(nome, () => { modo = k; render(); }, '', rodando); b.setAttribute('aria-pressed', String(modo === k)); seg.append(b);
  }
  const l1 = el('div', 'linha');
  l1.append(seg, botao('Executar todos os testes', () => void executar(CENARIOS), 'principal', rodando),
    botao(`Executar só os que falharam (${falhados.length})`, () => void executar(falhados), '', rodando || !falhados.length),
    botao('Parar', () => ctrl?.abort(), '', !rodando),
    botao('Copiar relatório', () => { void navigator.clipboard?.writeText(relatorio()).then(() => { progresso = 'Relatório copiado.'; render(); }).catch(() => undefined); }));
  p.append(l1, el('p', 'sub', modo === 'modelo'
    ? `A Ana real responde cada cenário e um avaliador dá nota aos 12 critérios. São ${CENARIOS.length} cenários, com algumas chamadas ao Claude por cenário, usando a sua conta do claude.ai. Leva alguns minutos.`
    : 'Sem modelo: a classificação e a redação da Ana são simuladas. Confere servidor, regras, ferramentas, aprovações e privacidade em segundos.'));
  if (progresso) p.append(el('p', 'sub', progresso));
  const cont = (s: string) => [...resultados.values()].filter(r => r.status === s).length;
  const chips = el('div', 'chips');
  chips.append(el('span', 'chip PASSOU', `PASSOU ${cont('PASSOU')}`), el('span', 'chip PARCIAL', `PARCIALMENTE APROVADO ${cont('PARCIALMENTE APROVADO')}`), el('span', 'chip FALHOU', `FALHOU ${cont('FALHOU')}`), el('span', 'chip NAO', `não executados ${CENARIOS.length - resultados.size}`));
  const porCat = new Map<Categoria, number>();
  for (const r of resultados.values()) if (r.status !== 'PASSOU') for (const c of r.categorias) porCat.set(c, (porCat.get(c) ?? 0) + 1);
  for (const [c, n] of porCat) chips.append(el('span', 'chip', `${NOMES_CATEGORIA[c]}: ${n}`));
  p.append(chips);
  const filtros = el('div', 'linha'); filtros.style.marginTop = '10px';
  const sel = (opcoes: [string, string][], valor: string, fn: (v: string) => void) => { const s = el('select'); for (const [v, t] of opcoes) { const o = el('option', '', t); o.value = v; o.selected = v === valor; s.append(o); } s.onchange = () => fn(s.value); return s; };
  filtros.append(sel([['todos', 'Todos os status'], ['PASSOU', 'Passou'], ['PARCIALMENTE APROVADO', 'Parcialmente aprovado'], ['FALHOU', 'Falhou'], ['nao', 'Não executado']], filtroStatus, v => { filtroStatus = v; render(); }),
    sel([['todos', 'Todos os blocos'], ['A', 'A · Identificação'], ['B', 'B · Processos'], ['C', 'C · Aprovação'], ['D', 'D · Limites'], ['E', 'E · Falhas técnicas']], filtroBloco, v => { filtroBloco = v; render(); }));
  p.append(filtros);
  app.append(p);

  const lista = el('section', 'lista');
  for (const c of CENARIOS) {
    const r = resultados.get(c.id);
    if (filtroBloco !== 'todos' && c.bloco !== filtroBloco) continue;
    if (filtroStatus === 'nao' ? !!r : filtroStatus !== 'todos' && r?.status !== filtroStatus) continue;
    const item = el('article', 'item');
    const cab = el('div', 'cab');
    cab.append(el('span', `st ${classe(r?.status)}`, r?.status ?? 'NÃO EXECUTADO'), el('code', '', c.id));
    const t = el('div'); t.append(el('div', 't', c.titulo)); if (r) t.append(el('div', 'm', `${r.categorias.length ? `Origem: ${r.categorias.map(k => NOMES_CATEGORIA[k]).join(', ')} · ` : ''}${r.motivo.slice(0, 180)}`));
    cab.append(t, botao('Executar', () => void executar([c]), '', rodando));
    cab.onclick = ev => { if ((ev.target as HTMLElement).tagName === 'BUTTON') return; if (abertos.has(c.id)) abertos.delete(c.id); else abertos.add(c.id); render(); };
    item.append(cab);
    if (abertos.has(c.id)) item.append(detalhe(c, r));
    lista.append(item);
  }
  app.append(lista);
}

function detalhe(c: Cenario, r?: ResultadoCenario) {
  const d = el('div', 'det');
  const def = el('div'); def.append(el('h3', '', 'Definição do cenário'), dl([
    ['Cliente(s)', Object.entries(c.conversas).map(([k, v]) => `${k}: ${v.nome} · ${v.telefone} (${v.perfil})`).join('; ')],
    ['Dados do ProJuris', `${c.projuris}${c.falha ? ` · falha simulada: ${c.falha.tipo}` : ''}`],
    ['Horário simulado', new Date(c.relogio).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
    ['Sequência', c.passos.map(p => p.cliente !== undefined || p.arquivo ? `cliente${p.conversa ? ` ${p.conversa}` : ''}: "${p.cliente || p.arquivo}"` : p.revisora ? `revisora${p.origem ? ' (conta não autorizada)' : ''}: "${p.revisora}"` : `relógio +${p.avancarMin ?? 0} min`).join(' → ')],
    ['Resultado esperado', c.esperado], ['Ações permitidas', c.permitidas.join('; ')], ['Ações proibidas', c.proibidas.join('; ')], ['Aprovação', c.aprovacao],
    ['Ferramentas esperadas', c.ferramentas.esperadas.join(', ') || 'nenhuma'], ['Ferramentas proibidas', c.ferramentas.proibidas.join(', ') || 'nenhuma'], ['Comportamento da Ana', c.comportamento],
  ]));
  d.append(def);
  const res = el('div'); res.append(el('h3', '', r ? `Resultado · ${r.status}` : 'Ainda não executado'));
  if (r) {
    res.append(dl([['Motivo', r.motivo], ['Origem provável', r.categorias.map(k => NOMES_CATEGORIA[k]).join(', ') || '—'], ['Ferramentas usadas', r.ferramentas.join(', ') || 'nenhuma'], ['Classificação da Ana', r.intencoes.join(', ') || '—'], ['Ações realizadas', r.acoes.join(' · ') || '—'], ['Modo · tempo', `${r.modo === 'modelo' ? 'Ana real' : 'regressão'} · ${(r.ms / 1000).toFixed(1)} s`]]));
    const v = el('div'); v.style.marginTop = '8px';
    for (const x of r.verificacoes) v.append(el('div', x.ok ? 'ok' : 'ko', `${x.ok ? '✓' : '✗'} ${x.descricao}${x.ok ? '' : ` — ${x.detalhe ?? ''} [${NOMES_CATEGORIA[x.categoria]}${x.critica ? ', crítica' : ''}]`}`));
    res.append(v);
  }
  d.append(res);
  if (r?.avaliacao) {
    const a = el('div', 'full'); a.append(el('h3', '', 'Avaliação de qualidade'));
    if (r.avaliacao.erro) a.append(el('p', 'sub', r.avaliacao.erro));
    const g = el('div', 'crit');
    for (const [id, nome] of CRITERIOS) { const n = r.avaliacao.criterios[id]; g.append(el('span', '', nome), el('strong', n && n.nota <= 2 ? 'ko' : n && n.nota >= 4 ? 'ok' : '', n ? String(n.nota) : '—'), el('span', 'mot', n?.motivo ?? '')); }
    a.append(g); if (r.avaliacao.resumo) a.append(el('p', 'sub', r.avaliacao.resumo)); d.append(a);
  }
  if (r?.transcricao.length) {
    const tr = el('div', 'full'); tr.append(el('h3', '', 'Conversa'));
    for (const l of r.transcricao) tr.append(el('div', `msg ${l.de}`, `${l.conversa !== '-' && Object.keys(c.conversas).length > 1 ? `[${l.conversa}] ` : ''}${l.de === 'cliente' ? 'Cliente' : l.de === 'ana' ? 'Ana' : l.de === 'revisora' ? 'Revisora' : 'Sistema'}: ${l.texto}`));
    d.append(tr);
  }
  return d;
}

async function iniciar() {
  carregarLocal();
  render();
  if (!window.claude) return;
  const [s, d] = await Promise.all([window.claude.use('sample').catch(() => null), window.claude.use('db').catch(() => null)]);
  sample = (s as SampleFn | null) ?? null;
  db = (d as Db | null) ?? null;
  if (db) {
    const parar = db.collection('bateria').orderBy('id').limit(200).onSnapshot(snap => {
      for (const doc of snap.docs) { const v = doc.data(); if (v) resultados.set(doc.id, v as unknown as ResultadoCenario); }
      render();
      setTimeout(() => parar(), 0);
    }, () => undefined);
  }
  render();
}
void iniciar();
