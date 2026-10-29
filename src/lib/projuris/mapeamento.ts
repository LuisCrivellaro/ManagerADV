// Converte respostas do ProJuris em tipos do Manager. Os nomes de campo seguem a documentação pública
// (Pessoas, Processos, Andamentos, Consultas tipo). O formato exato das listas é conferido no primeiro teste
// real (script tools/projuris-teste-conexao, opção --estrutura). Campo ausente nunca libera dado protegido.
import type { PessoaComTelefones, TelefonePessoa } from './identificacao';
import type { AndamentoPJ, EnvolvidoPJ, ProcessoPJ } from './processos';

type Obj = Record<string, unknown>;
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v.trim()) : Number.NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : undefined;
}

function txt(v: unknown): string | undefined {
  if (typeof v === 'string') return v.trim() || undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (ehObj(v)) return txt(v['valor'] ?? v['nome'] ?? v['descricao']);
  return undefined;
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Registros de uma resposta: array direto, uma das chaves conhecidas ou a única propriedade que for lista. */
export function registros(raw: unknown, chaves: string[] = []): Obj[] {
  if (Array.isArray(raw)) return raw.filter(ehObj);
  if (!ehObj(raw)) return [];
  for (const c of chaves) {
    const v = raw[c];
    if (Array.isArray(v)) return v.filter(ehObj);
  }
  const listas = Object.values(raw).filter(Array.isArray);
  return listas.length === 1 ? (listas[0] as unknown[]).filter(ehObj) : [];
}

/** Total informado pela API (totalRegistros) ou, na falta, o tamanho da lista. */
export function totalRegistros(raw: unknown, chaves: string[] = []): number {
  if (ehObj(raw) && typeof raw['totalRegistros'] === 'number') return raw['totalRegistros'];
  return registros(raw, chaves).length;
}

export function pessoaDe(r: Obj): PessoaComTelefones | undefined {
  const codigo = num(r['codigoPessoa'] ?? r['codigo']);
  const nome = txt(r['nomePessoa'] ?? r['nome'] ?? r['razaoSocial']);
  if (!codigo || !nome) return undefined;
  const lista = registros(r['telefones'] ?? r['pessoaTelefoneWs'] ?? r['pessoaTelefones'], ['pessoaTelefoneWs', 'telefones']);
  const telefones: TelefonePessoa[] = [];
  for (const t of lista) {
    const tel = ehObj(t['telefone']) ? t['telefone'] : t;
    const numero = txt(tel['numeroTelefone'] ?? tel['numero']);
    if (numero) telefones.push({ numero, principal: t['principal'] === true });
  }
  return { codigo, nome, telefones };
}

export function processoDe(r: Obj): ProcessoPJ | undefined {
  const codigo = num(r['codigoProcesso'] ?? r['codigo']);
  if (!codigo) return undefined;
  const numeros = r['processoNumeroWs'];
  const lista = Array.isArray(numeros) ? numeros.filter(ehObj) : [];
  const n = lista.length ? lista.find(x => x['principal'] === true) ?? lista[0] : numeros;
  const numero = ehObj(n) ? txt(n['numeroProcesso'] ?? n['numero']) : txt(n);
  const sit = r['situacaoProcesso'];
  const codigoSituacao = ehObj(sit) ? num(sit['chave'] ?? sit['codigo'] ?? sit['codigoSituacao']) : num(r['codigoSituacao'] ?? sit);
  const situacao = ehObj(sit) ? txt(sit['valor'] ?? sit['nome']) : undefined;
  const envolvidos: EnvolvidoPJ[] = [];
  for (const e of registros(r['processoEnvolvidoSimplificadoWs'] ?? r['envolvidos'], ['processoEnvolvidoSimplificadoWs'])) {
    const pessoa = e['pessoa'];
    const codigoPessoa = num(e['codigoPessoa'] ?? (ehObj(pessoa) ? pessoa['chave'] ?? pessoa['codigo'] : undefined));
    if (codigoPessoa) envolvidos.push({ codigoPessoa, cliente: e['flagCliente'] === true });
  }
  const orgao = txt(r['orgaoJudicial']), vara = txt(r['vara']), assunto = txt(r['assunto']);
  return {
    codigo,
    ...(numero ? { numero } : {}),
    ...(orgao ? { orgao } : {}),
    ...(vara ? { vara } : {}),
    ...(assunto ? { assunto } : {}),
    ...(codigoSituacao ? { codigoSituacao } : {}),
    ...(situacao ? { situacao } : {}),
    segredoJustica: r['segredoJustica'] !== false,
    envolvidos,
  };
}

export function andamentoDe(r: Obj): AndamentoPJ | undefined {
  const codigo = num(r['codigoAndamento'] ?? r['codigo']);
  const descricao = txt(r['descricaoAndamento'] ?? r['descricao']);
  if (!codigo || !descricao) return undefined;
  const data = typeof r['dataAndamento'] === 'number' ? String(r['dataAndamento']) : txt(r['dataAndamento']);
  const hora = txt(r['horaAndamento']), tipo = txt(r['nomeTipoAndamento']);
  return { codigo, descricao, privado: r['privado'] !== false, ...(data ? { data } : {}), ...(hora ? { hora } : {}), ...(tipo ? { tipo } : {}) };
}

/** Código da situação "Ativo" vindo da consulta tipo; sem resposta única, não adivinha. */
export function codigoSituacaoAtiva(raw: unknown): number | undefined {
  const achados = new Set<number>();
  const visitar = (v: unknown, profundidade: number) => {
    if (profundidade > 6) return;
    if (Array.isArray(v)) { for (const x of v) visitar(x, profundidade + 1); return; }
    if (!ehObj(v)) return;
    const nome = txt(v['valor'] ?? v['nome'] ?? v['descricao']);
    const chave = num(v['chave'] ?? v['codigo']);
    if (chave && nome && /^ativ[oa]$/.test(fold(nome))) achados.add(chave);
    for (const x of Object.values(v)) visitar(x, profundidade + 1);
  };
  visitar(raw, 0);
  return achados.size === 1 ? [...achados][0] : undefined;
}
