// Interface do Simulador da Ana. Usa o Claude pela página (capacidade "sample") e o motor fiel em engine.ts.
import identidadeOriginal from '@/lib/atendimento/ana-prompt.txt?raw';
import restricoesOriginal from '@/lib/atendimento/ana-restrictions.txt?raw';
import { anaSchema } from '@/lib/atendimento/ana-rules';
import { formatarHorarioCliente } from '@/lib/atendimento';
import { SimuladorAna, agendaFicticia, type Gerado, type Treino, type Turno } from './engine';

// ---------- Tipos mínimos do runtime do claude.ai ----------
type SampleFn = ((input: unknown, opts?: Record<string, unknown>) => Promise<{ text: string; truncated: boolean; modelTierApplied?: string; modelApplied?: string }>);
type Snap = { id: string; data(): Record<string, unknown> | undefined };
type Db = { collection(p: string): { add(d: Record<string, unknown>): Promise<unknown>; orderBy(f: string, d?: string): { limit(n: number): { onSnapshot(fn: (s: { docs: Snap[] }) => void, err?: (e: unknown) => void): () => void } }; doc(id?: string): { delete(): Promise<void>; set(d: Record<string, unknown>): Promise<void> } }; doc(p: string): { set(d: Record<string, unknown>): Promise<void>; get(): Promise<{ exists?: boolean; data(): Record<string, unknown> | undefined }> } };
declare global { interface Window { claude?: { use(name: string): Promise<unknown> } } }

const MODELO_ANA = 'claude-haiku-5-5';
const TREINO_PRODUCAO: Treino = {
  instrucoes: 'Responda com clareza e acolhimento. Não prometa resultados. Encaminhe questões jurídicas à advogada responsável.',
  proibidos: ['garantia de resultado', 'prazo de pagamento', 'valor da causa', 'honorários', 'ganhar'],
  exemplos: [],
};

// ---------- Ajustes (o que a Dra./equipe edita para treinar) ----------
interface Ajustes { identidade: string; restricoes: string; instrucoes: string; proibidos: string; exemplos: string }
const ORIGINAL: Ajustes = { identidade: identidadeOriginal, restricoes: restricoesOriginal, instrucoes: TREINO_PRODUCAO.instrucoes, proibidos: TREINO_PRODUCAO.proibidos.join('\n'), exemplos: '' };
function lerLocal<T>(k: string, padrao: T): T { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : padrao; } catch { return padrao; } }
function gravarLocal(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sem armazenamento */ } }
let ajustes: Ajustes = { ...ORIGINAL, ...lerLocal<Partial<Ajustes>>('sim-ana-ajustes', {}) };
function treinoDeAjustes(a: Ajustes): Treino {
  const exemplos: Treino['exemplos'] = [];
  for (const bloco of a.exemplos.split(/\n\s*\n/)) {
    const p = bloco.match(/^\s*(?:P|Cliente)\s*:\s*([\s\S]*?)\n\s*(?:R|Ana)\s*:\s*([\s\S]*)$/i);
    if (p?.[1]?.trim() && p[2]?.trim()) exemplos.push({ pergunta: p[1].trim(), resposta: p[2].trim() });
  }
  return { instrucoes: a.instrucoes, proibidos: a.proibidos.split(/[\n,;]/).map(s => s.trim()).filter(Boolean), exemplos };
}
const alterado = (k: keyof Ajustes) => ajustes[k].trim() !== ORIGINAL[k].trim();
const algumAlterado = () => (Object.keys(ORIGINAL) as (keyof Ajustes)[]).some(alterado);

// ---------- Claude ----------
let sample: SampleFn | null = null;
let db: Db | null = null;
function lerJson(texto: string): unknown {
  const limpo = texto.replace(/```(?:json)?/g, '').trim();
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw Object.assign(new Error('Resposta sem JSON.'), { code: 'invalid_json' });
  return JSON.parse(limpo.slice(ini, fim + 1));
}
const ERROS: Record<string, string> = {
  not_granted: 'Você não permitiu que a página use o Claude. Recarregue e escolha Permitir.',
  sampling_disabled: 'O Claude não está disponível para esta conta.',
  rate_limited: 'Limite de uso atingido. Espere um pouco e envie de novo.',
  session_expired: 'Sua sessão expirou. Entre de novo no claude.ai.',
  refused: 'O Claude recusou responder a esta mensagem.',
  empty_completion: 'O Claude não devolveu texto. Tente reformular.',
  cancelled: 'Interrompido.',
  upstream_error: 'Falha temporária de conexão com o Claude. Envie de novo.',
};
const gerar = async (contexto: unknown, instrucoes: string, signal?: AbortSignal): Promise<Gerado> => {
  if (!sample) throw new Error('Claude indisponível nesta visualização.');
  // Mesmo texto montado por gerarRespostaAna (ana.functions.ts).
  const identidadeCompleta = `${ajustes.identidade}\n\n${ajustes.restricoes}\n${instrucoes}`;
  const contrato = `Responda somente com um objeto JSON válido neste schema: ${JSON.stringify(anaSchema.toJSONSchema())}. Não execute ferramentas; as operações são validadas pelo servidor.`;
  const input = [{ role: 'user', content: `${identidadeCompleta}\n\n${contrato}` }, { role: 'user', content: JSON.stringify(contexto) }];
  const opts = { model: MODELO_ANA, modelTier: 'quick', cache: false, ...(signal ? { signal } : {}) };
  try {
    const res = await sample(input, opts);
    let obj: unknown, bruto = res.text;
    try { obj = lerJson(res.text); }
    catch {
      const de_novo = await sample([...input, { role: 'assistant', content: res.text || '(vazio)' }, { role: 'user', content: 'Responda de novo, só com o objeto JSON pedido, sem texto antes ou depois.' }], opts);
      bruto = de_novo.text;
      try { obj = lerJson(de_novo.text); } catch { throw new Error('O Claude respondeu fora do formato JSON.'); }
    }
    const parsed = anaSchema.safeParse(obj);
    if (!parsed.success) throw new Error(`JSON fora do contrato da Ana: ${parsed.error.issues.slice(0, 2).map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    return { resultado: parsed.data, bruto, modelo: res.modelApplied, tier: res.modelTierApplied };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code && ERROS[code]) throw new Error(ERROS[code]);
    throw e;
  }
};

const sim = new SimuladorAna(gerar, treinoDeAjustes(ajustes), 'novo');

// ---------- DOM helpers ----------
const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e;
}
const horaAgora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

// ---------- Estado da interface ----------
let turnoSelecionado: Turno | undefined;
let ocupado = false;
let ctl: AbortController | undefined;
let ultimoModelo = '';
interface Item { tipo: 'cliente' | 'ana' | 'retida' | 'nota' | 'erro'; texto: string; hora: string; turno?: Turno }
let itens: Item[] = [];

const CENARIOS: { rotulo: string; texto: string }[] = [
  { rotulo: 'Oi', texto: 'Oi, boa tarde' },
  { rotulo: 'Campanha AC', texto: 'Olá Dra. Carolina, gostaria de agendar uma consulta gratuita.' },
  { rotulo: 'Campanha RT', texto: 'Olá Dra. Carolina! Gostaria de mais informações.' },
  { rotulo: 'Quero agendar', texto: 'Quero marcar uma consulta' },
  { rotulo: 'Meu nome', texto: 'Meu nome é Mariana Souza Lima' },
  { rotulo: 'A primeira', texto: 'Pode ser a primeira' },
  { rotulo: 'Outros horários', texto: 'Tem outros horários?' },
  { rotulo: 'Mesmos horários', texto: 'De novo esses mesmos horários? Não servem' },
  { rotulo: 'À tarde', texto: 'Prefiro à tarde' },
  { rotulo: 'Horário exato', texto: 'Tem quinta às 15h?' },
  { rotulo: 'Cancelar', texto: 'Quero cancelar minha consulta' },
  { rotulo: 'Sim, cancela', texto: 'Sim' },
  { rotulo: 'Remarcar', texto: 'Preciso remarcar a consulta' },
  { rotulo: 'Já sou cliente', texto: 'Já sou cliente do escritório, queria marcar um horário' },
  { rotulo: 'Tenho direito?', texto: 'Fui demitido grávida, tenho direito a indenização? Quanto eu ganho?' },
  { rotulo: 'Falar com a Dra.', texto: 'Quero falar com a doutora, não com robô' },
  { rotulo: 'Perigo', texto: 'Meu ex-marido está me ameaçando agora, estou com medo' },
  { rotulo: 'Robô?', texto: 'Você é uma pessoa ou um robô?' },
  { rotulo: 'Meu processo', texto: 'Oi, já sou cliente. Como está o andamento do meu processo?' },
  { rotulo: 'Outro assunto', texto: 'Vocês fazem inventário?' },
  { rotulo: 'Valores', texto: 'Quanto custa a consulta e os honorários?' },
];

// ---------- Render: chat ----------
function renderChat() {
  const box = $('#chat');
  box.replaceChildren();
  if (!itens.length) {
    const vazio = el('div', 'vazio');
    vazio.append(el('p', 'vazio-tit', 'Converse como se fosse o cliente.'));
    vazio.append(el('p', '', 'Escreva abaixo ou toque em um cenário. A Ana responde com o prompt e as regras reais do sistema; a agenda é fictícia e nada é enviado a ninguém.'));
    box.append(vazio);
  }
  for (const it of itens) {
    if (it.tipo === 'nota' || it.tipo === 'erro') { box.append(el('div', `nota ${it.tipo}`, it.texto)); continue; }
    const wrap = el('div', `msg ${it.tipo}`);
    if (it.tipo === 'retida') wrap.append(el('div', 'retida-tit', 'Retida para revisão da equipe · o cliente não recebe'));
    const bolha = el('div', 'bolha');
    bolha.append(linkificar(it.texto));
    const meta = el('div', 'meta');
    meta.append(el('span', '', it.hora));
    if (it.turno && it.tipo !== 'cliente') {
      const t = it.turno;
      const ver = el('button', 'lnk', t === turnoSelecionado ? 'Bastidores ◂' : 'Ver bastidores');
      ver.type = 'button';
      ver.onclick = () => { turnoSelecionado = t; abrirAba('turno'); renderTudo(); };
      meta.append(ver);
      const anotar = el('button', 'lnk anotar', 'Anotar problema');
      anotar.type = 'button';
      anotar.onclick = () => abrirAnotacao(wrap, it);
      meta.append(anotar);
    }
    wrap.append(bolha, meta);
    if (it.turno === turnoSelecionado && it.tipo !== 'cliente') wrap.classList.add('sel');
    box.append(wrap);
  }
  if (ocupado) {
    const dig = el('div', 'msg ana digitando');
    const b = el('div', 'bolha'); b.append(el('span', 'pontos', 'Ana está digitando'));
    const parar = el('button', 'lnk', 'Parar'); parar.type = 'button'; parar.onclick = () => ctl?.abort();
    dig.append(b, parar); box.append(dig);
  }
  box.scrollTop = box.scrollHeight;
}
function linkificar(texto: string) {
  const frag = document.createDocumentFragment();
  for (const parte of texto.split(/(https:\/\/\S+)/g)) {
    if (/^https:\/\//.test(parte)) { const a = el('a', '', parte); a.href = parte; a.target = '_blank'; a.rel = 'noopener'; frag.append(a); }
    else frag.append(document.createTextNode(parte));
  }
  return frag;
}

function abrirAnotacao(wrap: HTMLElement, it: Item) {
  if (wrap.querySelector('.anot')) return;
  const f = el('form', 'anot');
  const ta = el('textarea'); ta.id = `anot-${Date.now()}`; ta.rows = 3; ta.placeholder = 'O que não ficou legal? Ex.: "repetiu a pergunta do nome", "muito formal", "deveria ter oferecido horários"';
  const lbl = el('label', 'sr', 'Comentário sobre esta resposta'); lbl.htmlFor = ta.id;
  const linha = el('div', 'anot-acoes');
  const salvar = el('button', 'btn pri', 'Salvar anotação'); salvar.type = 'submit';
  const cancelar = el('button', 'btn', 'Cancelar'); cancelar.type = 'button'; cancelar.onclick = () => f.remove();
  linha.append(salvar, cancelar);
  f.append(lbl, ta, linha);
  f.onsubmit = async ev => {
    ev.preventDefault();
    if (!ta.value.trim()) { ta.focus(); return; }
    salvar.disabled = true;
    await salvarAnotacao(ta.value.trim(), it);
    f.replaceChildren(el('div', 'ok', 'Anotado. Veja na aba Anotações.'));
    setTimeout(() => f.remove(), 2200);
  };
  wrap.append(f); ta.focus();
}

// ---------- Anotações ----------
interface Anotacao { id: string; criadoEm: string; comentario: string; mensagemAna: string; tipoResposta: string; clienteDisse: string; conversa: { de: string; texto: string }[]; bastidores: Record<string, unknown>; ajustesAlterados: boolean; modelo: string }
let anotacoes: Anotacao[] = lerLocal<Anotacao[]>('sim-ana-anotacoes', []);
async function salvarAnotacao(comentario: string, it: Item) {
  const t = it.turno;
  const nota: Omit<Anotacao, 'id'> = {
    criadoEm: new Date().toISOString(), comentario, mensagemAna: it.texto, tipoResposta: it.tipo === 'retida' ? 'retida para revisão' : 'enviada ao cliente',
    clienteDisse: t?.textoCliente ?? '',
    conversa: sim.conv.mensagens.slice(-14).map(m => ({ de: m.de === 'cliente' ? 'cliente' : 'ana', texto: m.texto.slice(0, 1200) })),
    bastidores: t ? { intencao_claude: t.claude?.intencao ?? '', acao_claude: t.claude?.acao ?? '', mensagem_claude: t.claude?.mensagem ?? '', intencao_final: t.final?.intencao ?? '', acao_final: t.final?.acao ?? '', encaminhar_humano: t.final?.encaminhar_humano ?? false, urgente: t.final?.urgente ?? false, proximo_passo: t.final?.proximo_passo ?? '', motivo: t.final?.motivo_aprovacao ?? '', eventos: t.eventos } : {},
    ajustesAlterados: algumAlterado(), modelo: t?.modelo ?? t?.tier ?? '',
  };
  if (db) {
    try { await db.collection('anotacoes').add(nota as unknown as Record<string, unknown>); return; }
    catch { /* cai para o navegador */ }
  }
  anotacoes = [{ id: `local-${Date.now()}`, ...nota }, ...anotacoes];
  gravarLocal('sim-ana-anotacoes', anotacoes);
  renderAnotacoes();
}
function textoAnotacoes() {
  return anotacoes.map((a, i) => `#${i + 1} — ${new Date(a.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\nCliente: ${a.clienteDisse}\nAna (${a.tipoResposta}): ${a.mensagemAna}\nProblema: ${a.comentario}`).join('\n\n');
}
function renderAnotacoes() {
  const box = $('#aba-anotacoes');
  box.replaceChildren();
  const topo = el('div', 'linha');
  topo.append(el('p', 'sub', db ? 'Salvas nesta página: o Claude lê direto daqui para corrigir a Ana.' : 'Salvas só neste navegador. Use "Copiar tudo" e cole na conversa com o Claude.'));
  const copiar = el('button', 'btn', 'Copiar tudo'); copiar.type = 'button'; copiar.disabled = !anotacoes.length;
  copiar.onclick = async () => { try { await navigator.clipboard.writeText(textoAnotacoes()); copiar.textContent = 'Copiado'; } catch { const ta = el('textarea'); ta.value = textoAnotacoes(); box.append(ta); ta.select(); } setTimeout(() => (copiar.textContent = 'Copiar tudo'), 1800); };
  topo.append(copiar);
  box.append(topo);
  if (!anotacoes.length) { box.append(el('p', 'vazio-p', 'Nenhuma anotação ainda. Em qualquer resposta da Ana, toque em "Anotar problema".')); return; }
  for (const a of anotacoes) {
    const card = el('article', 'anot-card');
    const cab = el('div', 'linha');
    cab.append(el('span', 'meta-t', new Date(a.criadoEm).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })));
    const del = el('button', 'lnk', 'Excluir'); del.type = 'button';
    del.onclick = async () => {
      if (db && !a.id.startsWith('local-')) { try { await db.collection('anotacoes').doc(a.id).delete(); } catch { /* ignora */ } }
      else { anotacoes = anotacoes.filter(x => x.id !== a.id); gravarLocal('sim-ana-anotacoes', anotacoes); renderAnotacoes(); }
    };
    cab.append(del);
    card.append(cab);
    card.append(el('p', 'problema', a.comentario));
    const q = el('div', 'cit'); q.append(el('span', 'rot', 'Cliente'), el('span', '', a.clienteDisse)); card.append(q);
    const r = el('div', 'cit'); r.append(el('span', 'rot', `Ana · ${a.tipoResposta}`), el('span', '', a.mensagemAna)); card.append(r);
    box.append(card);
  }
}

// ---------- Render: bastidores do turno ----------
const NOMES: Record<string, string> = { duvida_geral: 'Dúvida geral', novo_caso: 'Novo caso', agendamento: 'Agendamento', processo: 'Processo', documento: 'Documento', reclamacao: 'Reclamação', outro: 'Outro', enviar: 'Enviar ao cliente', rascunho: 'Reter para a equipe', nenhuma: 'Não responder' };
function campo(rot: string, valor: string | HTMLElement, cls = '') {
  const d = el('div', `campo ${cls}`); d.append(el('span', 'rot', rot));
  if (typeof valor === 'string') d.append(el('span', 'val', valor || '—')); else d.append(valor);
  return d;
}
function pill(texto: string, tom: 'ok' | 'alerta' | 'neutro' | 'perigo') { return el('span', `pill ${tom}`, texto); }
function renderTurno() {
  const box = $('#aba-turno');
  box.replaceChildren();
  const t = turnoSelecionado;
  if (!t) { box.append(el('p', 'vazio-p', 'Envie uma mensagem para ver aqui o que a Ana entendeu, o que o servidor decidiu e por quê.')); return; }
  box.append(campo('Cliente disse', t.textoCliente, 'destaque'));
  if (t.erro) box.append(campo('Falha', t.erro, 'perigo'));
  if (t.claude) {
    const s = el('section', 'bloco');
    s.append(el('h3', '', '1 · O que o Claude entendeu'));
    const pills = el('div', 'pills');
    pills.append(pill(NOMES[t.claude.intencao] ?? t.claude.intencao, 'neutro'), pill(NOMES[t.claude.acao] ?? t.claude.acao, t.claude.acao === 'enviar' ? 'ok' : 'alerta'));
    if (t.claude.urgente) pills.append(pill('Urgente', 'perigo'));
    if (t.claude.encaminhar_humano) pills.append(pill('Pediu equipe', 'alerta'));
    s.append(pills);
    s.append(campo('Resposta proposta', t.claude.mensagem));
    const d = t.claude.dados_coletados;
    s.append(campo('Dados coletados', [d.nome && `Nome: ${d.nome}`, d.assunto && `Assunto: ${d.assunto}`, d.email && `E-mail: ${d.email}`].filter(Boolean).join(' · ')));
    s.append(campo('Próximo passo (Claude)', t.claude.proximo_passo));
    if (t.claude.motivo_aprovacao) s.append(campo('Motivo de revisão', t.claude.motivo_aprovacao));
    box.append(s);
  }
  if (t.final || t.semResposta) {
    const s = el('section', 'bloco');
    s.append(el('h3', '', '2 · O que o servidor fez'));
    if (t.final) {
      const pills = el('div', 'pills');
      pills.append(pill(NOMES[t.final.intencao] ?? t.final.intencao, 'neutro'), pill(t.enviada !== undefined ? 'Enviada ao cliente' : t.retida !== undefined ? 'Retida para revisão' : 'Sem resposta', t.enviada !== undefined ? 'ok' : 'alerta'));
      if (t.final.encaminhar_humano) pills.append(pill('Passou para a equipe', 'alerta'));
      if (t.final.urgente) pills.append(pill('Urgente', 'perigo'));
      s.append(pills);
      const mudou = t.claude && (t.enviada ?? t.retida ?? '') !== t.claude.mensagem;
      if (mudou) s.append(el('p', 'aviso', 'O texto final não é o que o Claude escreveu: as regras do servidor substituíram ou ajustaram a mensagem.'));
      s.append(campo('Próximo passo', t.final.proximo_passo));
      if (t.final.motivo_aprovacao) s.append(campo('Motivo da retenção', t.final.motivo_aprovacao));
    }
    if (t.semResposta) s.append(campo('Sem resposta', t.semResposta));
    if (t.eventos.length) { const ul = el('ul', 'eventos'); for (const e of t.eventos) ul.append(el('li', '', e)); s.append(campo('Ações', ul)); }
    box.append(s);
  }
  const tec = el('details', 'tec');
  tec.append(el('summary', '', 'Detalhes técnicos'));
  tec.append(campo('Modelo', t.modelo ? t.modelo : `${t.tier ?? '—'}${t.tier ? ' (o modelo da Ana não respondeu; veja o aviso no topo)' : ''}`));
  if (t.ms) tec.append(campo('Tempo', `${(t.ms / 1000).toFixed(1)} s`));
  if (t.bruto) { const pre = el('pre', '', t.bruto); tec.append(campo('Resposta bruta do Claude', pre)); }
  if (t.contexto) { const pre = el('pre', '', JSON.stringify(t.contexto, null, 2)); tec.append(campo('Contexto enviado pelo servidor', pre)); }
  box.append(tec);
}

// ---------- Render: agenda ----------
function renderAgenda() {
  const box = $('#aba-agenda');
  box.replaceChildren();
  const topo = el('div', 'linha');
  const falha = el('label', 'chk');
  const cb = el('input'); cb.type = 'checkbox'; cb.id = 'falha-agenda'; cb.checked = sim.agendaFalhando;
  cb.onchange = () => { sim.agendaFalhando = cb.checked; renderTudo(); };
  falha.append(cb, document.createTextNode(' Simular agenda fora do ar'));
  const nova = el('button', 'btn', 'Sortear outra agenda'); nova.type = 'button';
  nova.onclick = () => { const daAna = sim.agenda.filter(e => e.daAna); sim.agenda = [...agendaFicticia(new Date(), Math.floor(Math.random() * 9999)), ...daAna].sort((a, b) => a.inicio.localeCompare(b.inicio)); renderAgenda(); };
  topo.append(falha, nova);
  box.append(topo);
  box.append(el('p', 'sub', 'Agenda fictícia. Regras reais: novos seg–qui 9h–17h30, clientes sexta 13h30–17h30, 30 min, sem feriados nacionais. Em verde, o que a Ana marcou.'));
  const agora = Date.now();
  const futuros = sim.agenda.filter(e => Date.parse(e.fim) > agora).slice(0, 60);
  let dia = '';
  const lista = el('div', 'agenda');
  for (const e of futuros) {
    const d = new Date(e.inicio).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short', day: '2-digit', month: '2-digit' });
    if (d !== dia) { dia = d; lista.append(el('div', 'dia', d)); }
    const h = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
    const row = el('div', `ev ${e.daAna ? 'ana' : ''}`);
    row.append(el('span', 'h', `${h(e.inicio)}–${h(e.fim)}`), el('span', '', e.titulo));
    lista.append(row);
  }
  box.append(lista);
}

// ---------- Render: ajustes ----------
const CAMPOS: { k: keyof Ajustes; rot: string; ajuda: string; linhas: number }[] = [
  { k: 'instrucoes', rot: 'Instruções do Treinamento', ajuda: 'O mesmo campo da tela Treinamento de IA. Vale na hora quando salvo no sistema publicado.', linhas: 4 },
  { k: 'exemplos', rot: 'Exemplos de resposta', ajuda: 'Um exemplo por bloco, separado por linha em branco. Formato:\nP: pergunta do cliente\nR: resposta ideal da Ana', linhas: 6 },
  { k: 'proibidos', rot: 'Temas proibidos', ajuda: 'Um por linha. Se aparecerem, a resposta vira registro para a equipe.', linhas: 4 },
  { k: 'identidade', rot: 'Identidade da Ana (ana-prompt.txt)', ajuda: 'Fica no código. Mudanças aqui precisam ir para a Lovable e ser publicadas.', linhas: 18 },
  { k: 'restricoes', rot: 'Restrições (ana-restrictions.txt)', ajuda: 'Fica no código, como a identidade.', linhas: 10 },
];
function renderAjustes() {
  const box = $('#aba-ajustes');
  box.replaceChildren();
  box.append(el('p', 'sub', 'Edite e converse de novo: a próxima resposta já usa o texto novo. Quando estiver bom, envie para o Claude aplicar no sistema.'));
  for (const c of CAMPOS) {
    const g = el('div', 'grupo');
    const lab = el('label', 'rot-campo', c.rot); lab.htmlFor = `aj-${c.k}`;
    if (alterado(c.k)) lab.append(el('span', 'pill alerta mini', 'alterado'));
    const ta = el('textarea'); ta.id = `aj-${c.k}`; ta.rows = c.linhas; ta.value = ajustes[c.k]; ta.spellcheck = true;
    ta.oninput = () => { ajustes = { ...ajustes, [c.k]: ta.value }; gravarLocal('sim-ana-ajustes', ajustes); sim.treino = treinoDeAjustes(ajustes); lab.querySelector('.pill')?.remove(); if (alterado(c.k)) lab.append(el('span', 'pill alerta mini', 'alterado')); };
    const ajuda = el('p', 'ajuda', c.ajuda);
    const rest = el('button', 'lnk', 'Restaurar original'); rest.type = 'button'; rest.disabled = !alterado(c.k);
    rest.onclick = () => { ajustes = { ...ajustes, [c.k]: ORIGINAL[c.k] }; gravarLocal('sim-ana-ajustes', ajustes); sim.treino = treinoDeAjustes(ajustes); renderAjustes(); };
    const rodape = el('div', 'linha'); rodape.append(ajuda, rest);
    g.append(lab, ta, rodape);
    box.append(g);
  }
  const acoes = el('div', 'linha fim');
  const status = el('span', 'sub', '');
  const enviar = el('button', 'btn pri', 'Enviar ajustes para o Claude'); enviar.type = 'button'; enviar.disabled = !algumAlterado();
  enviar.onclick = async () => {
    const pacote = { salvoEm: new Date().toISOString(), ...ajustes, alterados: (Object.keys(ORIGINAL) as (keyof Ajustes)[]).filter(alterado) };
    if (db) {
      try { await db.doc('ajustes/atual').set(pacote); await db.collection('ajustes_historico').add(pacote); status.textContent = 'Enviado. Avise o Claude na conversa.'; return; }
      catch { status.textContent = 'Não consegui salvar na página. Use Copiar.'; }
    }
    try { await navigator.clipboard.writeText(JSON.stringify(pacote, null, 2)); status.textContent = 'Copiado. Cole na conversa com o Claude.'; } catch { status.textContent = 'Copie os textos manualmente.'; }
  };
  acoes.append(status, enviar);
  box.append(acoes);
}

// ---------- Topo e estado ----------
function renderTopo() {
  const st = $('#estado');
  st.replaceChildren();
  const a = sim.conv.agenteAna;
  if (a?.humano || a?.pausa) {
    st.append(pill('Com a equipe · Ana em silêncio', 'alerta'));
    const dev = el('button', 'btn mini', 'Devolver para a Ana'); dev.type = 'button';
    dev.onclick = () => { sim.devolverParaAna(); itens.push({ tipo: 'nota', texto: 'Equipe devolveu a conversa para a Ana.', hora: horaAgora() }); renderTudo(); };
    st.append(dev);
  } else st.append(pill(sample ? 'Ana ativa · automática' : 'Claude indisponível', sample ? 'ok' : 'perigo'));
  if (sim.conv.consultaAgendada) st.append(pill(`Consulta: ${formatarHorarioCliente(sim.conv.consultaAgendada)}`, 'ok'));
  if (sim.agendaFalhando) st.append(pill('Agenda fora do ar', 'perigo'));
  if (algumAlterado()) st.append(pill('Usando ajustes', 'alerta'));
  const aviso = $('#aviso-modelo');
  aviso.hidden = !(ultimoModelo && ultimoModelo !== MODELO_ANA);
  if (!aviso.hidden) aviso.textContent = `Respondido por outro modelo (${ultimoModelo}), não pelo ${MODELO_ANA} da produção. O tom e as escolhas podem mudar um pouco.`;
}
function renderTudo() { renderTopo(); renderChat(); renderTurno(); renderAgenda(); renderAnotacoes(); }

function abrirAba(nome: string) {
  for (const b of document.querySelectorAll<HTMLButtonElement>('.abas button')) b.setAttribute('aria-selected', String(b.dataset['aba'] === nome));
  for (const p of document.querySelectorAll<HTMLElement>('.painel')) p.hidden = p.id !== `aba-${nome}`;
  if (nome === 'ajustes') renderAjustes();
}

// ---------- Envio ----------
async function enviar(texto: string) {
  texto = texto.trim();
  if (!texto || ocupado) return;
  if (!sample) { itens.push({ tipo: 'erro', texto: 'Abra esta página no claude.ai, com sessão iniciada, para conversar com a Ana.', hora: horaAgora() }); renderChat(); return; }
  ocupado = true; ctl = new AbortController();
  const entrada = $<HTMLTextAreaElement>('#entrada'); entrada.value = ''; atualizarBotao();
  itens.push({ tipo: 'cliente', texto, hora: horaAgora() });
  renderChat();
  try {
    const t = await sim.receber(texto, ctl.signal);
    itens[itens.length - 1]!.turno = t;
    turnoSelecionado = t;
    ultimoModelo = t.modelo ?? (t.tier ? `nível ${t.tier}` : ultimoModelo);
    if (t.enviada !== undefined) itens.push({ tipo: 'ana', texto: t.enviada, hora: horaAgora(), turno: t });
    else if (t.retida !== undefined) itens.push({ tipo: 'retida', texto: t.retida, hora: horaAgora(), turno: t });
    if (t.erro) itens.push({ tipo: 'erro', texto: `${t.erro} No sistema real, a conversa iria para a equipe.`, hora: horaAgora(), turno: t });
    else if (t.semResposta) itens.push({ tipo: 'nota', texto: t.semResposta, hora: horaAgora(), turno: t });
    if (t.final?.encaminhar_humano && !t.erro) itens.push({ tipo: 'nota', texto: 'Conversa passada para a equipe. A Ana fica em silêncio até alguém devolver (botão no topo).', hora: horaAgora() });
  } finally {
    ocupado = false; ctl = undefined;
    renderTudo();
    entrada.focus();
  }
}
function atualizarBotao() { $<HTMLButtonElement>('#enviar').disabled = ocupado || !$<HTMLTextAreaElement>('#entrada').value.trim(); }

// ---------- Inicialização ----------
function montar() {
  const chips = $('#cenarios');
  for (const c of CENARIOS) { const b = el('button', 'chip', c.rotulo); b.type = 'button'; b.title = c.texto; b.onclick = () => void enviar(c.texto); chips.append(b); }
  const entrada = $<HTMLTextAreaElement>('#entrada');
  entrada.oninput = atualizarBotao;
  entrada.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(entrada.value); } };
  $<HTMLFormElement>('#form').onsubmit = e => { e.preventDefault(); void enviar(entrada.value); };
  $<HTMLButtonElement>('#nova').onclick = () => {
    const perfil = $<HTMLSelectElement>('#perfil').value as 'novo' | 'cliente';
    ctl?.abort(); sim.reiniciar(perfil); itens = []; turnoSelecionado = undefined;
    // Consultas marcadas pela Ana numa conversa anterior saem da agenda fictícia.
    sim.agenda = sim.agenda.filter(e => !e.daAna);
    renderTudo();
  };
  for (const b of document.querySelectorAll<HTMLButtonElement>('.abas button')) b.onclick = () => abrirAba(b.dataset['aba'] ?? 'turno');
  abrirAba('turno');
  renderTudo();
  atualizarBotao();
}

async function conectar() {
  if (!window.claude) { renderTudo(); return; }
  const [s, d] = await Promise.all([window.claude.use('sample').catch(() => null), window.claude.use('db').catch(() => null)]);
  sample = (s as SampleFn | null) ?? null;
  db = (d as Db | null) ?? null;
  if (db) {
    try {
      db.collection('anotacoes').orderBy('criadoEm', 'desc').limit(200).onSnapshot(snap => {
        const remotas = snap.docs.map(x => ({ id: x.id, ...(x.data() as Omit<Anotacao, 'id'>) }));
        const locais = lerLocal<Anotacao[]>('sim-ana-anotacoes', []);
        anotacoes = [...remotas, ...locais];
        renderAnotacoes();
      }, () => undefined);
    } catch { /* fica no navegador */ }
  }
  renderTudo();
}

montar();
void conectar();
