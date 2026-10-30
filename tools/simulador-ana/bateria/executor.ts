// Executor da bateria: roda cada cenário (cliente, revisora e relógio) no motor do simulador, que usa as mesmas
// regras e o mesmo módulo de consulta do servidor. Modo "regressao": classificação e redação simuladas (sem modelo),
// para rodar a cada alteração. Modo "modelo": a Ana real (Claude) responde e um avaliador dá nota aos 12 critérios.
import { SimuladorAna, CentralRevisao, REVISORA_FICTICIA, type Gerador, type Treino } from '../engine';
import { projurisFicticioPadrao } from '@/lib/projuris/ficticio';
import type { EntradaRedacao } from '@/lib/atendimento/consulta-processo';
import { comRelogio } from './relogio';
import { verificacoesGerais, veredito, promptAvaliador, lerAvaliacao, type Avaliacao, type Categoria, type Execucao, type Linha, type ResultadoVerificacao, type Status, type Verificacao } from './avaliacao';
import type { Cenario, Passo } from './cenarios';

export interface ModoExecucao {
  tipo: 'regressao' | 'modelo';
  treino: Treino;
  gerar?: Gerador;
  redigir?: (e: EntradaRedacao) => Promise<string>;
  /** Avaliador de qualidade: recebe o prompt e devolve o texto JSON da avaliação. */
  avaliar?: (prompt: string) => Promise<string>;
  signal?: AbortSignal;
}

export interface ResultadoCenario {
  id: string;
  titulo: string;
  bloco: string;
  modo: ModoExecucao['tipo'];
  status: Status;
  motivo: string;
  categorias: Categoria[];
  mensagensCliente: string[];
  respostasAna: string[];
  acoes: string[];
  ferramentas: string[];
  intencoes: string[];
  verificacoes: ResultadoVerificacao[];
  avaliacao?: Avaliacao;
  transcricao: Linha[];
  ms: number;
  em: string;
}

/** Classificação simulada: a que o cenário espera da Ana (testa o servidor, não o modelo). */
function geradorSimulado(atual: () => Passo | undefined): Gerador {
  return async () => {
    const p = atual();
    const intencao = p?.intencao ?? 'duvida_geral';
    const humano = !!p?.humano;
    const mensagem = humano ? 'Vou passar sua conversa para a equipe.' : intencao === 'agendamento' ? 'Claro! Vou ver os horários livres para você.' : 'Por aqui eu cuido dos agendamentos. Posso marcar uma consulta para você?';
    return { resultado: { acao: 'enviar', mensagem, motivo_aprovacao: '', intencao, urgente: false, encaminhar_humano: humano, dados_coletados: { nome: '', cpf: '', assunto: '', email: '' }, proximo_passo: '' }, bruto: '(classificação simulada)', modelo: 'simulado' };
  };
}

/** Redação simulada fiel às regras (só fatos, uma linha por movimentação). */
export async function redacaoSimulada(e: EntradaRedacao): Promise<string> {
  const partes = e.processos.map(p => 'segredo_de_justica' in p
    ? 'Sobre um dos seus processos, nossa equipe vai entrar em contato com você.'
    : p.movimentacoes.length ? `No processo ${p.numero}, as últimas movimentações registradas foram:\n${p.movimentacoes.map(m => `• ${m.data}: ${m.descricao}`).join('\n')}` : `No processo ${p.numero}, não há movimentação nova registrada até o momento.`);
  return `${e.primeiro_nome ? `${e.primeiro_nome}, ` : ''}${partes.join('\n\n')}\n\nSe quiser entender o que alguma movimentação significa, a equipe explica.`;
}

function verificacoesDoCenario(c: Cenario): Verificacao[] {
  return [
    ...verificacoesGerais(),
    ...(c.verificacoes ?? []),
    { id: 'ferramentas-esperadas', descricao: 'Ferramentas esperadas foram chamadas', categoria: 'ferramenta', critica: true, testar: e => { const f = c.ferramentas.esperadas.filter(x => !e.ferramentas.includes(x)); return f.length ? `Não chamou: ${f.join(', ')}` : true; } },
    { id: 'ferramentas-proibidas', descricao: 'Nenhuma ferramenta proibida foi chamada', categoria: 'ferramenta', critica: true, testar: e => { const f = c.ferramentas.proibidas.filter(x => e.ferramentas.includes(x)); return f.length ? `Chamou: ${f.join(', ')}` : true; } },
    { id: 'aprovacao', descricao: c.aprovacao === 'necessária' ? 'Pedido de aprovação criado' : 'Nenhum pedido de aprovação', categoria: 'aprovacao', critica: true, testar: e => (c.aprovacao === 'necessária') === (e.pedidos.length > 0) ? true : `Pedidos criados: ${e.pedidos.length}` },
  ];
}

export async function executarCenario(c: Cenario, modo: ModoExecucao): Promise<ResultadoCenario> {
  const inicio = performance.now();
  const exec = await comRelogio(new Date(c.relogio), async relogio => {
    const dados = (c.dados ?? (x => x))(projurisFicticioPadrao());
    const central = new CentralRevisao(REVISORA_FICTICIA);
    let atual: Passo | undefined;
    const gerar = modo.tipo === 'regressao' ? geradorSimulado(() => atual) : modo.gerar;
    if (!gerar) throw new Error('Modo com a Ana real exige o Claude.');
    const redigir = modo.tipo === 'regressao' ? redacaoSimulada : modo.redigir;
    let chamadasPJ = 0;
    const falha = c.falha ? () => (chamadasPJ++ >= (c.falhaApos ?? 0) ? c.falha : undefined) : undefined;
    const sims: Record<string, SimuladorAna> = {};
    for (const [k, conv] of Object.entries(c.conversas)) {
      sims[k] = new SimuladorAna(gerar, modo.treino, conv.perfil, { conversaId: `bateria-${c.id}-${k}`, telefone: conv.telefone, nome: conv.nome, projuris: dados, central, ...(falha ? { falhaProjuris: falha } : {}), ...(redigir ? { redigir } : {}) });
    }
    const transcricao: Linha[] = [];
    const erros: string[] = [];
    const intencoes: string[] = [];
    const vistas: Record<string, number> = {};
    let vistasRevisora = 0;
    const sincronizar = () => {
      for (const [k, s] of Object.entries(sims)) {
        const msgs = s.conv.mensagens;
        for (let i = vistas[k] ?? 0; i < msgs.length; i++) { const m = msgs[i]!; transcricao.push({ conversa: k, de: m.de === 'cliente' ? 'cliente' : 'ana', texto: m.texto || m.arquivo || '' }); }
        vistas[k] = msgs.length;
      }
      for (; vistasRevisora < central.mensagensRevisora.length; vistasRevisora++) transcricao.push({ conversa: '-', de: 'revisora', texto: `(para a revisora) ${central.mensagensRevisora[vistasRevisora]}` });
    };
    for (const p of c.passos) {
      if (modo.signal?.aborted) throw new Error('Interrompido.');
      atual = p;
      if (p.avancarMin) { relogio.avancarMin(p.avancarMin); transcricao.push({ conversa: '-', de: 'sistema', texto: `(relógio: ${relogio.agora().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })})` }); }
      if (p.cliente !== undefined || p.arquivo) {
        const turno = await sims[p.conversa ?? 'A']!.receber(p.cliente ?? '', modo.signal, p.arquivo);
        if (turno.erro) erros.push(turno.erro);
        if (turno.claude) intencoes.push(turno.claude.intencao);
      }
      if (p.revisora) {
        sincronizar();
        transcricao.push({ conversa: '-', de: 'revisora', texto: `(revisora responde${p.origem && p.origem.canal !== 'manager' ? ` de ${p.origem.contato}` : ''}) ${p.revisora}` });
        await central.responder(p.revisora, p.origem ?? { canal: 'whatsapp', contato: REVISORA_FICTICIA });
      }
      if (p.pendencias) central.verificarPendencias();
      sincronizar();
    }
    const e: Execucao = {
      transcricao,
      ana: Object.fromEntries(Object.entries(sims).map(([k, s]) => [k, s.conv.mensagens.filter(m => m.de === 'escritorio').map(m => m.texto)])),
      ferramentas: Object.values(sims).flatMap(s => s.turnos.flatMap(t => t.ferramentas)),
      pedidos: central.pedidos.map(p => p.pedido),
      revisora: central.mensagensRevisora,
      registros: central.registros,
      eventos: Object.values(sims).flatMap(s => s.turnos.flatMap(t => t.eventos)),
      pausada: Object.fromEntries(Object.entries(sims).map(([k, s]) => [k, !!s.conv.agenteAna?.humano])),
      erros,
      intencoes,
      dados,
      nomes: Object.fromEntries(Object.entries(c.conversas).map(([k, v]) => [k, v.nome])),
    };
    return e;
  });

  const verificacoes: ResultadoVerificacao[] = verificacoesDoCenario(c).map(v => {
    let r: true | string;
    try { r = v.testar(exec); } catch (erro) { r = `A verificação não rodou: ${(erro as Error).message}`; }
    return { id: v.id, descricao: v.descricao, categoria: v.categoria, critica: v.critica, ok: r === true, ...(r === true ? {} : { detalhe: r }) };
  });
  // Na Ana real, ferramenta esperada que faltou por classificação errada é problema de prompt.
  if (modo.tipo === 'modelo') {
    const faltou = verificacoes.find(v => v.id === 'ferramentas-esperadas' && !v.ok);
    if (faltou && c.ferramentas.esperadas.includes('projuris.processos') && !exec.intencoes.includes('consulta_processo')) {
      faltou.categoria = 'prompt';
      faltou.detalhe = `${faltou.detalhe} · a Ana classificou como: ${exec.intencoes.join(', ') || '—'}`;
    }
  }
  let avaliacao: Avaliacao | undefined;
  if (modo.tipo === 'modelo' && modo.avaliar) {
    try { avaliacao = lerAvaliacao(await modo.avaliar(promptAvaliador(c, exec))); }
    catch (erro) { avaliacao = { criterios: {}, resumo: '', erro: `Avaliador indisponível: ${(erro as Error).message}` }; }
  }
  const vd = veredito(verificacoes, avaliacao);
  return {
    id: c.id, titulo: c.titulo, bloco: c.bloco, modo: modo.tipo, status: vd.status, motivo: vd.motivo, categorias: vd.categorias,
    mensagensCliente: c.passos.filter(p => p.cliente !== undefined || p.arquivo).map(p => p.cliente || p.arquivo || ''),
    respostasAna: Object.entries(exec.ana).flatMap(([k, msgs]) => msgs.map(m => Object.keys(exec.ana).length > 1 ? `[${k}] ${m}` : m)),
    acoes: [...exec.eventos, ...exec.registros],
    ferramentas: exec.ferramentas,
    intencoes: exec.intencoes,
    verificacoes,
    ...(avaliacao ? { avaliacao } : {}),
    transcricao: exec.transcricao,
    ms: Math.round(performance.now() - inicio),
    em: new Date().toISOString(),
  };
}

export async function executarBateria(cenarios: Cenario[], modo: ModoExecucao, aoConcluir?: (r: ResultadoCenario, i: number) => void | Promise<void>): Promise<ResultadoCenario[]> {
  const resultados: ResultadoCenario[] = [];
  for (const [i, c] of cenarios.entries()) {
    if (modo.signal?.aborted) break;
    const r = await executarCenario(c, modo);
    resultados.push(r);
    await aoConcluir?.(r, i);
  }
  return resultados;
}
