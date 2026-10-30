// Consultas de leitura ao ProJuris, já filtradas pelas regras de processos.ts. Só no servidor.
// A ordem dos andamentos na API não é documentada: busca a primeira e a última página e ordena aqui.
import { projuris, type ClienteProjuris } from './cliente.server';
import { ErroProjuris } from './erros';
import { andamentoDe, codigoSituacaoAtiva, pessoaDe, processoDe, registros, totalRegistros } from './mapeamento';
import { processosAtivosDoCliente, ultimosAndamentosPublicos, type AndamentoLegivel, type AndamentoPJ, type ProcessoPJ } from './processos';
import type { PessoaComTelefones } from './identificacao';

const CHAVES_PESSOA = ['pessoaConsultaCompleta', 'pessoaConsulta', 'pessoas', 'pessoaWs'];
const CHAVES_PROCESSO = ['processoConsultaCompleta', 'processoConsulta', 'processos', 'processoWs'];
const CHAVES_ANDAMENTO = ['andamentoProcessoWs', 'andamentoWs', 'andamentos'];
const POR_PAGINA = 50;
const MAX_PAGINAS_PROCESSOS = 5;

const definido = <T>(v: T | undefined): v is T => v !== undefined;

export function criarConsultasProjuris(cliente: Pick<ClienteProjuris, 'chamar'> = projuris, agora: () => number = Date.now) {
  let situacaoAtiva: { codigo: number; ate: number } | undefined;

  /** Código da situação "Ativo" pela consulta tipo, sem número fixo; guardado por 6 horas. */
  async function codigoSituacaoAtivo(): Promise<number> {
    if (situacaoAtiva && agora() < situacaoAtiva.ate) return situacaoAtiva.codigo;
    const codigo = codigoSituacaoAtiva(await cliente.chamar('tipo.consulta', { consulta: { 'chave-tipo': 'processo-situacao' } }));
    if (!codigo) throw new ErroProjuris('resposta', 'Situação "Ativo" não encontrada nas consultas tipo do ProJuris.');
    situacaoAtiva = { codigo, ate: agora() + 6 * 3600000 };
    return codigo;
  }

  /** Uma página de pessoas com telefones (para o índice de telefones principais). */
  async function pessoasCompletas(pagina: number, quantidade = 100): Promise<{ pessoas: PessoaComTelefones[]; total: number }> {
    const raw = await cliente.chamar('pessoa.consultaCompleta', { consulta: { pagina, 'quan-registros': quantidade }, corpo: {} });
    return { pessoas: registros(raw, CHAVES_PESSOA).map(pessoaDe).filter(definido), total: totalRegistros(raw, CHAVES_PESSOA) };
  }

  /** Processos ativos em que a pessoa é cliente. Confere de novo aqui, mesmo que a API já filtre. */
  async function processosAtivos(codigoPessoa: number): Promise<ProcessoPJ[]> {
    const ativo = await codigoSituacaoAtivo();
    const todos: ProcessoPJ[] = [];
    for (let pagina = 0; pagina < MAX_PAGINAS_PROCESSOS; pagina++) {
      const raw = await cliente.chamar('processo.consultaCompleta', {
        consulta: { pagina, 'quan-registros': POR_PAGINA },
        corpo: { codigoPessoaEnvolvido: codigoPessoa, codigoSituacao: ativo },
      });
      const lote = registros(raw, CHAVES_PROCESSO).map(processoDe).filter(definido);
      todos.push(...lote);
      if (lote.length < POR_PAGINA || todos.length >= totalRegistros(raw, CHAVES_PROCESSO)) break;
    }
    const unicos = [...new Map(todos.map(p => [p.codigo, p])).values()];
    return processosAtivosDoCliente(unicos, codigoPessoa, ativo);
  }

  /** As n últimas movimentações não privadas do processo. */
  async function ultimosAndamentos(codigoProcesso: number, n = 3): Promise<AndamentoLegivel[]> {
    const pagina = (p: number) => cliente.chamar('processo.andamentos', { parametros: { codigo: codigoProcesso }, consulta: { pagina: p, 'quan-registros': POR_PAGINA } });
    const primeira = await pagina(0);
    const andamentos: AndamentoPJ[] = registros(primeira, CHAVES_ANDAMENTO).map(andamentoDe).filter(definido);
    const total = totalRegistros(primeira, CHAVES_ANDAMENTO);
    const ultima = Math.ceil(total / POR_PAGINA) - 1;
    if (ultima > 0) andamentos.push(...registros(await pagina(ultima), CHAVES_ANDAMENTO).map(andamentoDe).filter(definido));
    return ultimosAndamentosPublicos([...new Map(andamentos.map(a => [a.codigo, a])).values()], n);
  }

  /** Pessoas pela busca geral com o CPF (só leitura). A escolha exata fica em vinculo.ts. */
  async function pessoasPorCpf(cpf: string): Promise<{ codigo: number; nome: string; cpf?: string }[]> {
    const raw = await cliente.chamar('pessoa.consulta', { consulta: { 'filtro-geral': cpf.replace(/\D/g, ''), pagina: 0, 'quan-registros': 20 } });
    return registros(raw, ['pessoaConsulta', 'pessoas']).flatMap(r => {
      const codigo = Number(r['codigoPessoa']), nome = typeof r['nome'] === 'string' ? r['nome'].trim() : '';
      const doc = typeof r['cpfOuCnpj'] === 'string' ? r['cpfOuCnpj'] : undefined;
      return Number.isSafeInteger(codigo) && codigo > 0 && nome ? [{ codigo, nome, ...(doc ? { cpf: doc } : {}) }] : [];
    });
  }

  return { codigoSituacaoAtivo, pessoasCompletas, processosAtivos, ultimosAndamentos, pessoasPorCpf };
}
