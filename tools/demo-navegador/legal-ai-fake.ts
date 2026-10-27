// Substitui legalAI (servidor) na demonstração: respostas simuladas, sem chamada externa e sem prompts internos.
import { REVIEW_CATEGORIES } from '@/lib/office';
import { etapaLabel, type Etapa } from '@/lib/mock-data';
// Aviso só nas peças internas (minuta e auditoria); mensagens ao cliente saem limpas.
const AVISO = '(Resposta simulada — versão de demonstração. Na versão real, a IA do escritório gera este texto.)';

type Msg = { de?: string; texto?: string; arquivo?: string };
const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const lista = (xs: string[]) => xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`;
const saudacao = () => { const h = Number(new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hourCycle: 'h23' }).format(new Date())); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'; };
// Palavras do cliente que apontam para cada documento do checklist.
const pistas: [RegExp, RegExp][] = [
  [/carteira|ctps/, /ctps|carteira/i], [/laudo/, /laudo/i], [/comprovante|residencia|conta de luz/, /resid/i],
  [/cnis|extrato/, /cnis/i], [/\brg\b|identidade|cnh/, /\brg\b|cnh/i], [/\bcpf\b/, /^cpf$/i],
];

function respostaCliente(p: string, etapa: string, falt: string[], mensagens: Msg[]): string {
  // Bloco de mensagens do cliente ainda sem resposta (ex.: vários arquivos seguidos).
  let i = mensagens.length - 1; const bloco: Msg[] = [];
  while (i >= 0 && mensagens[i]?.de === 'cliente') { bloco.unshift(mensagens[i]!); i--; }
  const ultima = bloco.at(-1);
  const texto = sem(bloco.map((m) => m.texto ?? '').join(' '));
  const arquivos = bloco.map((m) => m.arquivo).filter((a): a is string => !!a && !/^audio/i.test(sem(a)));
  const audio = bloco.some((m) => /^audio/i.test(sem(m.arquivo ?? '')));
  const faltam = falt.length ? ` Ainda faltam: ${lista(falt)}. Pode mandar foto ou PDF por aqui mesmo.` : '';

  if (!ultima) return falt.length ? `Olá, ${p}! Passando para lembrar dos documentos que ainda faltam: ${lista(falt)}. Pode mandar foto ou PDF por aqui mesmo.` : `Olá, ${p}! Tudo bem? Se precisar de algo, estamos à disposição.`;
  if (/quanto (eu )?vou (ganhar|receber)|chance de ganhar|vou ganhar|honorario|quanto custa|quanto cobra|vale a pena processar/.test(texto))
    return `Entendo a sua dúvida, ${p}, ela é importante. Quem pode avaliar isso com segurança é a Dra. Carolina, depois de analisar o seu caso. Vou deixar a sua pergunta registrada para ela.`;
  if (/audiencia|intimacao|citacao|oficial de justica|carta do forum|prazo/.test(texto))
    return `Obrigada por avisar, ${p}. Vou passar agora para a equipe dar prioridade ao seu caso. Se puder, mande uma foto do documento mostrando a data.`;
  if (audio) return `Olá, ${p}! Recebi o seu áudio e já vou ouvir com atenção. Se preferir, pode escrever por aqui também.`;
  if (arquivos.length && !texto.trim()) {
    const nomes = arquivos.length === 1 ? `o arquivo ${arquivos[0]}` : `os ${arquivos.length} arquivos`;
    return `Olá, ${p}! Recebemos ${nomes}, obrigada. A equipe vai conferir.${faltam}`;
  }
  const citados = falt.filter((d) => pistas.some(([cli, doc]) => cli.test(texto) && doc.test(d)));
  if (citados.length && /amanha|depois|ainda|vou mandar|mando|preciso pegar|vou pegar|pode ser|semana/.test(texto)) {
    const resto = falt.filter((d) => !citados.includes(d));
    const recebidos = arquivos.length ? ` Recebemos ${arquivos.length === 1 ? 'o arquivo' : `os ${arquivos.length} arquivos`}, obrigada.` : '';
    return `Pode sim, ${p}!${recebidos} Assim que tiver ${lista(citados)} em mãos, é só enviar por aqui, em foto ou PDF.${resto.length ? ` Depois disso, faltará só ${lista(resto)}.` : ''}`;
  }
  if (/demiti|mandado embora|mandaram embora|rescisao|verbas|trabalhist|carteira assinada|horas extras|fgts/.test(texto))
    return `${saudacao()}, ${p}! Sinto muito pela situação. Sim, a Dra. Carolina Santos atua em Direito Trabalhista. Para ela entender o seu caso, podemos agendar uma consulta inicial. Qual período fica melhor para você: manhã ou tarde?`;
  if (/horario|agendar|agenda|marcar|consulta|reuniao/.test(texto))
    return `Claro, ${p}! Vou verificar os horários livres da Dra. Carolina e já te envio as opções por aqui.`;
  if (/processo|andamento|novidade|como esta|alguma noticia/.test(texto))
    return `Olá, ${p}! Vou conferir o andamento do seu processo com a Dra. Carolina e retorno com as informações.`;
  if (/acompanhante|levar alguem|posso levar/.test(texto))
    return `Pode sim, ${p}! Se precisar de mais alguma orientação para o dia, é só chamar.`;
  if (/^(ok|certo|beleza|obrigad[oa]|valeu|perfeito|combinado)[!. ]*$/.test(texto.trim()))
    return `Por nada, ${p}! Qualquer dúvida, é só chamar.`;
  if (/^(oi|ola|bom dia|boa tarde|boa noite)[!.,]*$/.test(texto.trim()))
    return `${saudacao()}, ${p}! Aqui é da equipe da Dra. Carolina Santos. Como posso ajudar?`;
  if (etapa === 'documentos' && falt.length) return `Obrigada pela mensagem, ${p}!${faltam}`;
  return `Olá, ${p}! Recebemos a sua mensagem. Vou verificar com a Dra. Carolina e retorno em breve.`;
}
export async function legalAI(kind: 'petition' | 'audit' | 'training', context: string, area: string, _training: string) {
  await new Promise((r) => setTimeout(r, 1100));
  let c: any = {}; try { c = JSON.parse(context); } catch { /* ignora */ }
  const nome = c.cliente ?? 'Cliente';
  const primeiro = String(nome).split(' ')[0];
  const base = { memorial: '', pendencias: [] as string[], revisao: [] as any[], novosFatos: [] as string[] };
  if (kind === 'training') {
    const t = String(c.tarefa ?? '');
    const falt: string[] = c.faltantes ?? [];
    if (t.startsWith('Resuma')) {
      const etapa = etapaLabel[c.etapa as Etapa] ?? 'etapa não informada';
      return { ...base, texto: `${nome} · ${etapa}. ${falt.length ? `Faltam ${falt.length} documento(s): ${lista(falt)}.` : 'Nenhum documento pendente.'}` };
    }
    if (t.startsWith('Traduza')) return { ...base, texto: `Olá, ${primeiro}! Houve uma movimentação no seu processo: ${String(c.texto ?? '').trim() || 'o juiz deu andamento ao caso'}. Por enquanto você não precisa fazer nada; se for preciso, avisamos por aqui.` };
    // Sugestão de resposta: só a mensagem que iria ao cliente, de acordo com a situação da conversa.
    return { ...base, texto: respostaCliente(primeiro, c.etapa, falt, c.mensagens ?? []) };
  }
  if (kind === 'petition') {
    return { ...base, texto: `EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA ___ VARA COMPETENTE\n\n${String(nome).toUpperCase()}, qualificação completa a conferir nos documentos, vem, por seus advogados, propor a presente\n\nAÇÃO (${area})\n\npelos fatos e fundamentos a seguir.\n\nI – DOS FATOS\n\n[Fatos extraídos do atendimento e dos documentos — revisar.]\n\nII – DO DIREITO\n\n[Fundamentação — citações sem fonte verificada ficam como pendência.]\n\nIII – DOS PEDIDOS\n\na) [pedido principal];\nb) a condenação nas verbas de sucumbência.\n\nDá-se à causa o valor de R$ [a calcular].\n\nNestes termos, pede deferimento.\n\n${AVISO}`, pendencias: ['Conferir qualificação completa', 'Calcular valor da causa'] };
  }
  return { ...base, texto: `Relatório de auditoria — ${nome}\n\nA análise foi feita apenas sobre os dados disponíveis na demonstração; nenhum anexo foi conferido. ${AVISO}`,
    revisao: REVIEW_CATEGORIES.map((item, i) => ({ item, status: i % 4 === 0 ? 'PENDENTE' : 'SIM', constatacao: i % 4 === 0 ? 'Não foi possível conferir na demonstração.' : 'Item conferido de forma simulada.', providencia: i % 4 === 0 ? 'Revisão humana necessária.' : '', localizacao: i % 4 === 0 ? '' : 'Minuta, item correspondente' })),
    pendencias: ['Revisão humana dos itens marcados como PENDENTE'], novosFatos: [] };
}
