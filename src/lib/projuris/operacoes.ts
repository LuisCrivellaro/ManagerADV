// Lista fechada das operações que o Manager ADV pode fazer no ProJuris. O cliente HTTP só aceita um id desta
// lista, nunca um caminho livre. Não há (e não deve haver) operação para apagar, ler arquivos ou documentos,
// financeiro, horas, comentários, solicitações, criar ou alterar tarefas, audiências e atendimentos, nem para
// usuários, perfis, configurações, webhooks ou notificações, mesmo que a API permita.
// Etapa atual: só consultas. Os cadastros feitos pela equipe entram em etapa própria, com conferência.

export interface OperacaoProjuris {
  metodo: 'GET' | 'POST';
  /** Caminho relativo a /adv-service/, com {parametro} numérico. */
  caminho: string;
  /** POST de consulta não grava nada: só filtra. */
  somenteLeitura: true;
  descricao: string;
}

export const OPERACOES_PROJURIS = {
  'tipo.consulta': { metodo: 'GET', caminho: 'tipo', somenteLeitura: true, descricao: 'Consultas tipo (ex.: situações de processo)' },
  'pessoa.obter': { metodo: 'GET', caminho: 'pessoa/{codigo}', somenteLeitura: true, descricao: 'Dados de uma pessoa' },
  'pessoa.consulta': { metodo: 'GET', caminho: 'pessoa/consulta', somenteLeitura: true, descricao: 'Busca por nome, e-mail ou CPF/CNPJ' },
  'pessoa.consultaCompleta': { metodo: 'POST', caminho: 'pessoa/consulta-completa', somenteLeitura: true, descricao: 'Busca com dados completos (telefones)' },
  'processo.consultaCompleta': { metodo: 'POST', caminho: 'processo/consulta-completa', somenteLeitura: true, descricao: 'Processos por envolvido e situação' },
  'processo.andamentos': { metodo: 'GET', caminho: 'processo/{codigo}/andamento/consulta', somenteLeitura: true, descricao: 'Andamentos de um processo' },
} as const satisfies Record<string, OperacaoProjuris>;

export type IdOperacaoProjuris = keyof typeof OPERACOES_PROJURIS;

/** Monta o caminho da operação; só aceita parâmetros numéricos positivos (códigos do ProJuris). */
export function caminhoOperacao(id: IdOperacaoProjuris, parametros: Record<string, number> = {}): string {
  const op: OperacaoProjuris | undefined = (OPERACOES_PROJURIS as Record<string, OperacaoProjuris>)[id];
  if (!op) throw new Error('Operação do ProJuris não permitida.');
  return op.caminho.replace(/\{(\w+)\}/g, (_, nome: string) => {
    const valor = parametros[nome];
    if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor <= 0) throw new Error('Parâmetro inválido para o ProJuris.');
    return String(valor);
  });
}
