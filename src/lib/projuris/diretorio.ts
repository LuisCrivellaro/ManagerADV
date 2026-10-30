// Lista de pessoas do ProJuris para consulta ao vivo na página Clientes. Nada é gravado no Manager.
// Campos seguem a resposta real de pessoa/consulta (lista `pessoaConsulta`).

export interface ClienteProjurisDiretorio {
  codigo: number;
  nome: string;
  tipo: string;
  cpfCnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  nascimento: string | null;
  classificacoes: string | null;
  habilitado: boolean;
  incluidoEm: string | null;
}

type Obj = Record<string, unknown>;
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);
const data = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? new Date(v).toISOString().slice(0, 10) : txt(v));

export function clienteDiretorioDe(r: Obj): ClienteProjurisDiretorio | undefined {
  const codigo = r['codigoPessoa'];
  const nome = txt(r['nome']);
  if (typeof codigo !== 'number' || !Number.isSafeInteger(codigo) || codigo <= 0 || !nome) return undefined;
  const rua = [txt(r['logradouro']), txt(r['numero']), txt(r['complemento'])].filter(Boolean).join(', ');
  const endereco = [rua, txt(r['bairro']), txt(r['cep'])].filter(Boolean).join(' · ') || null;
  return {
    codigo, nome,
    tipo: txt(r['tipoPessoa']) ?? '',
    cpfCnpj: txt(r['cpfOuCnpj']), telefone: txt(r['telefonePrincipal']), email: txt(r['emailPrincipal']),
    endereco, cidade: txt(r['cidadePrincipal']), estado: txt(r['estadoPrincipal']),
    nascimento: data(r['dataNascimento']), classificacoes: txt(r['classificacoes']),
    habilitado: r['habilitado'] === true, incluidoEm: data(r['dtInclusao']),
  };
}

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const digitos = (s: string) => s.replace(/\D/g, '');

/** Busca por nome, CPF/CNPJ, telefone, e-mail ou cidade; página começa em 0. */
export function filtrarDiretorio(lista: ClienteProjurisDiretorio[], busca: string, pagina: number, porPagina: number) {
  const b = fold(busca.trim());
  const d = digitos(busca);
  const achados = !b ? lista : lista.filter(c =>
    fold([c.nome, c.email, c.cidade].filter(Boolean).join(' ')).includes(b) ||
    (d.length >= 3 && [c.cpfCnpj, c.telefone].some(v => v && digitos(v).includes(d))));
  const ordenados = [...achados].sort((a, z) => a.nome.localeCompare(z.nome, 'pt-BR'));
  const inicio = Math.max(0, pagina) * porPagina;
  return { total: ordenados.length, itens: ordenados.slice(inicio, inicio + porPagina) };
}
