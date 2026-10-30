// Índice dos telefones principais do ProJuris, só no servidor: fica na memória da instância por 30 minutos e
// guarda apenas código, nome e telefones principais. Nunca vai ao navegador nem a logs.
import { criarConsultasProjuris } from './consultas.server';
import { identificarPorTelefone, type Identificacao, type PessoaComTelefones } from './identificacao';

const VALIDADE_MS = 30 * 60000;
const POR_PAGINA = 100;
const MAX_PAGINAS = 200;

type Consultas = Pick<ReturnType<typeof criarConsultasProjuris>, 'pessoasCompletas'>;

let cache: { pessoas: PessoaComTelefones[]; ate: number } | undefined;
let carregando: Promise<PessoaComTelefones[]> | undefined;

/** Lê todas as páginas de pessoas e mantém só quem tem telefone principal. */
export async function carregarIndiceProjuris(consultas: Consultas = criarConsultasProjuris()): Promise<PessoaComTelefones[]> {
  const pessoas: PessoaComTelefones[] = [];
  let lidos = 0;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { pessoas: lote, total } = await consultas.pessoasCompletas(pagina, POR_PAGINA);
    lidos += lote.length;
    for (const p of lote) {
      const principais = p.telefones.filter(t => t.principal);
      if (principais.length) pessoas.push({ codigo: p.codigo, nome: p.nome, telefones: principais });
    }
    if (!lote.length || lote.length < POR_PAGINA || lidos >= total) break;
  }
  return pessoas;
}

async function indice(agora: number, consultas?: Consultas): Promise<PessoaComTelefones[]> {
  if (cache && agora < cache.ate) return cache.pessoas;
  carregando ??= carregarIndiceProjuris(consultas).then(p => { cache = { pessoas: p, ate: Date.now() + VALIDADE_MS }; return p; }).finally(() => { carregando = undefined; });
  return carregando;
}

/** Identificação pelo telefone principal (único, nenhum ou duplicado), com o índice em cache. */
export async function identificarClienteProjuris(telefone: string, consultas?: Consultas): Promise<Identificacao> {
  return identificarPorTelefone(telefone, await indice(Date.now(), consultas));
}

/** Para testes e para forçar nova leitura depois de um cadastro ou atualização de telefone. */
export function limparIndiceProjuris() { cache = undefined; }
