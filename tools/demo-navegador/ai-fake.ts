// Substitui o SDK de IA na demonstração: análise de documento simulada, sem chamada externa.
export const Output = { object: (o: any) => o };
export const NoObjectGeneratedError = { isInstance: () => false };
export function streamText(opts: any) {
  const text = JSON.stringify(opts.messages ?? []);
  const nome = /Arquivo: ([^\\"]+)/.exec(text)?.[1] ?? 'documento';
  const itens = (/Itens do checklist: ([^\\"]+)/.exec(text)?.[1] ?? '').split('; ').filter(Boolean);
  const n = nome.toLowerCase();
  const guess = itens.find((i) => n.includes(i.split(' ')[0]!.toLowerCase().slice(0, 4))) ?? (n.includes('laudo') ? itens.find((i) => i.includes('Laudo')) : n.includes('rg') ? itens.find((i) => i.includes('RG')) : n.includes('resid') ? itens.find((i) => i.includes('residência')) : undefined) ?? null;
  const output = new Promise((r) => setTimeout(() => r({
    tipoDocumento: guess ?? 'Documento não identificado', itemChecklist: guess, confianca: guess ? 'media' : 'baixa', nomeTitular: null, cpf: null, datas: [],
    detalhesCaso: ['Análise simulada — versão de demonstração, nenhum dado foi enviado à IA.'], observacoes: 'Na versão real, a IA lê o conteúdo do arquivo e extrai titular, CPF, datas e fatos úteis.',
  }), 900));
  return { output };
}
