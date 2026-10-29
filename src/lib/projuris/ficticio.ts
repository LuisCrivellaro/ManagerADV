// ProJuris fictício para testes e para o simulador da Ana. Só dados inventados: nomes, telefones de teste,
// números de processo fictícios. Aplica os mesmos filtros do servidor (identificação, ativo, cliente, privado).
import { identificarPorTelefone, type Identificacao, type PessoaComTelefones } from './identificacao';
import { processosAtivosDoCliente, ultimosAndamentosPublicos, type AndamentoLegivel, type AndamentoPJ, type ProcessoPJ } from './processos';
import { ErroProjuris, type TipoErroProjuris } from './erros';

export const SITUACAO_ATIVO_FICTICIA = 7;
const ARQUIVADO = 9;

export interface ProjurisFicticio { pessoas: PessoaComTelefones[]; processos: ProcessoPJ[]; andamentos: Record<number, AndamentoPJ[]> }

const pessoa = (codigo: number, nome: string, ...telefones: [string, boolean][]): PessoaComTelefones => ({ codigo, nome, telefones: telefones.map(([numero, principal]) => ({ numero, principal })) });
const proc = (codigo: number, numero: string, assunto: string, orgao: string, vara: string, situacao: number, envolvidos: [number, boolean][], segredoJustica = false): ProcessoPJ =>
  ({ codigo, numero, assunto, orgao, vara, codigoSituacao: situacao, segredoJustica, envolvidos: envolvidos.map(([codigoPessoa, cliente]) => ({ codigoPessoa, cliente })) });
const and = (codigo: number, data: string, tipo: string, descricao: string, privado = false): AndamentoPJ => ({ codigo, data, tipo, descricao, privado });

/** Personas: cada telefone corresponde a um cenário do roteiro de testes. */
export const TELEFONES_FICTICIOS = {
  umProcesso: '5511990000001',
  tresProcessos: '5511990000002',
  soArquivados: '5511990000003',
  duplicado: '5511990000004',
  naoPrincipal: '5511990000005',
  segredo: '5511990000006',
  semAndamento: '5511990000007',
  naoCliente: '5511990000008',
  desconhecido: '5511990000099',
} as const;

export function projurisFicticioPadrao(): ProjurisFicticio {
  return {
    pessoas: [
      pessoa(101, 'Marina Fictícia Souza', ['(11) 99000-0001', true]),
      pessoa(102, 'Joana Teste Lima', ['11 99000-0002', true]),
      pessoa(103, 'Carlos Exemplo Rocha', ['11990000003', true]),
      pessoa(104, 'Pedro Simulado Alves', ['11 99000-0004', true]),
      pessoa(105, 'Pedro Simulado Neto', ['5511990000004', true]),
      pessoa(106, 'Lucas Ensaio Prado', ['11 3000-0000', true], ['11 99000-0005', false]),
      pessoa(107, 'Rita Modelo Dias', ['11 99000-0006', true]),
      pessoa(108, 'Bruno Piloto Melo', ['11 99000-0007', true]),
      pessoa(109, 'Ana Testemunha Cruz', ['11 99000-0008', true]),
    ],
    processos: [
      proc(1001, '1000001-11.2026.5.02.0001', 'Verbas rescisórias e horas extras', 'TRT-2', '1ª Vara do Trabalho de São Paulo', SITUACAO_ATIVO_FICTICIA, [[101, true], [900, false]]),
      proc(2001, '1000002-22.2025.5.02.0002', 'Horas extras', 'TRT-2', '2ª Vara do Trabalho de São Paulo', SITUACAO_ATIVO_FICTICIA, [[102, true]]),
      proc(2002, '1000003-33.2025.8.26.0100', 'Alimentos', 'TJSP', '3ª Vara de Família e Sucessões', SITUACAO_ATIVO_FICTICIA, [[102, true]], true),
      proc(2003, '1000004-44.2026.8.26.0100', 'Indenização por danos morais', 'TJSP', '5ª Vara Cível', SITUACAO_ATIVO_FICTICIA, [[102, true]]),
      proc(3001, '1000005-55.2023.8.26.0100', 'Cobrança', 'TJSP', '1ª Vara Cível', ARQUIVADO, [[103, true]]),
      proc(6001, '1000006-66.2025.8.26.0100', 'Guarda', 'TJSP', '1ª Vara de Família', SITUACAO_ATIVO_FICTICIA, [[107, true]], true),
      proc(7001, '1000007-77.2026.5.02.0003', 'Reconhecimento de vínculo', 'TRT-2', '3ª Vara do Trabalho de São Paulo', SITUACAO_ATIVO_FICTICIA, [[108, true]]),
      proc(8001, '1000008-88.2026.8.26.0100', 'Indenização', 'TJSP', '2ª Vara Cível', SITUACAO_ATIVO_FICTICIA, [[109, false], [999, true]]),
    ],
    andamentos: {
      1001: [
        and(1, '2026-10-21', 'Despacho', 'Designada audiência de instrução para 10/12/2026, às 14h.'),
        and(2, '2026-10-24', 'Anotação interna', 'Estratégia: avaliar proposta de acordo antes da audiência.', true),
        and(3, '2026-10-02', 'Juntada', 'Juntada de contestação pela reclamada.'),
        and(4, '2026-09-15', 'Citação', 'Reclamada citada.'),
        and(5, '2026-08-30', 'Distribuição', 'Processo distribuído.'),
      ],
      2001: [and(11, '2026-10-20', 'Sentença', 'Publicada sentença de parcial procedência.'), and(12, '2026-09-01', 'Audiência', 'Realizada audiência de instrução.')],
      2002: [and(21, '2026-10-18', 'Decisão', 'Decisão sobre alimentos provisórios.')],
      2003: [and(31, '2026-10-10', 'Conclusão', 'Conclusos para decisão.')],
      7001: [],
      8001: [and(81, '2026-10-01', 'Despacho', 'Intimem-se.')],
    },
  };
}

export interface FalhaFicticia { tipo: TipoErroProjuris; status?: number }

/** Portas de consulta sobre os dados fictícios, com falhas opcionais (403, 429, tempo esgotado etc.). */
export function criarProjurisFicticio(dados: ProjurisFicticio = projurisFicticioPadrao(), opcoes: { falha?: () => FalhaFicticia | undefined } = {}) {
  const talvezFalhe = () => {
    const f = opcoes.falha?.();
    if (f) throw new ErroProjuris(f.tipo, 'Falha simulada do ProJuris.', f.status);
  };
  return {
    async identificar(telefone: string): Promise<Identificacao> { talvezFalhe(); return identificarPorTelefone(telefone, dados.pessoas); },
    async processosAtivos(codigoPessoa: number): Promise<ProcessoPJ[]> { talvezFalhe(); return processosAtivosDoCliente(dados.processos, codigoPessoa, SITUACAO_ATIVO_FICTICIA); },
    async ultimosAndamentos(codigoProcesso: number): Promise<AndamentoLegivel[]> { talvezFalhe(); return ultimosAndamentosPublicos(dados.andamentos[codigoProcesso] ?? []); },
  };
}
