// Mensagens prontas do Atendimento: biblioteca padrão + mensagens criadas pela equipe.
// Regras puras (sem React, sem banco) para poderem ser testadas.
import type { Conversa, Etapa } from './mock-data';
import { normalized } from './atendimento';

export const REPLY_CATEGORIES = ['Boas-vindas', 'Documentos', 'Agendamento', 'Processo', 'Geral'] as const;
export type ReplyCategory = (typeof REPLY_CATEGORIES)[number];

export interface QuickReply {
  id: string;
  titulo: string;
  texto: string;
  categoria: ReplyCategory;
  /** Digitado depois da barra na caixa de mensagem, ex.: "ola" para /ola. */
  atalho: string;
  /** Etapas em que a mensagem aparece como sugestão rápida. */
  etapas?: Etapa[] | undefined;
  padrao?: boolean | undefined;
}

/** O que fica salvo na área de trabalho do usuário (raiz do office_workspace, como as automações). */
export interface SavedReplies {
  itens: QuickReply[];
  /** Mensagens padrão que o usuário removeu da lista. */
  ocultas: string[];
}

export const VARIABLES = [
  { key: 'nome', label: 'Primeiro nome' },
  { key: 'nome_completo', label: 'Nome completo' },
  { key: 'documentos_faltantes', label: 'Documentos faltantes' },
  { key: 'atendimento', label: 'Nº do atendimento' },
  { key: 'data_horario', label: 'Data e horário (preencher)' },
] as const;

export const DEFAULT_REPLIES: QuickReply[] = [
  {"id": "oficial-boasvindas", "titulo": "Boas-vindas", "categoria": "Boas-vindas", "atalho": "boasvindas", "texto": "Olá, {nome}!\n\nSeja bem-vindo(a) 😊\nEquipe CS Advocacia\nwww.carolinasantos.com.br", "etapas": ["inicial"]},
  {"id": "oficial-consulta", "titulo": "Oferecer consulta gratuita", "categoria": "Agendamento", "atalho": "consulta", "texto": "Vou te ajudar!\nNossa primeira consulta é on-line e gratuita.\nTemos horários amanhã, às {horario1} ou às {horario2}.\n\nO que fica melhor para você?", "etapas": ["inicial"]},
  {"id": "oficial-orcamento", "titulo": "Orçamento (Tabela OAB/SP)", "categoria": "Geral", "atalho": "orcamento", "texto": "Oi, {nome} 😊\n\nConforme solicitado, segue o orçamento dos serviços jurídicos:\n\n📌 Para o seu caso, vamos fazer o valor mínimo previsto na Tabela da OAB/SP.\n\n📋 Item 4.27 – *Ação de Tomada de Decisão Apoiada*\nValor mínimo da Tabela OAB/SP: R$ 4.344,80.\n\n✅ Para pagamento à vista (PIX), conseguimos conceder 10% de desconto.\n\n📌 O valor também pode ser parcelado em até *10x de R$ 434,50 no cartão*.\n\n📌 Caso prefira, também é possível realizar uma entrada e parcelar o restante. Nessa modalidade, conseguimos manter os 10% de desconto sobre o valor total.\n\nAssim que você aprovar, já encaminhamos o link de pagamento e a documentação necessária para iniciarmos a demanda com a urgência solicitada 😊\n\nFicamos à disposição para qualquer dúvida! Orçamento válido por 5 dias!\n\nEquipe CS Lawyers ⚖️🩵"},
  {"id": "oficial-audiencia", "titulo": "Lembrete de audiência", "categoria": "Processo", "atalho": "audiencia", "texto": "Oi, {nome}! 😊\n\nEstamos passando para te lembrar da sua audiência, que será realizada {modalidade}, no dia {data} às {horario} – {tipo_audiencia}.\n\n📌 Processo: {processo}\n📌 Vara: {vara}\n\n📍 Local da audiência:\n{endereco}\n\n📌 Solicitamos que você compareça ao local com uma hora de antecedência, portando um documento oficial com foto.\n\n📌 Caso possua testemunha, pedimos que a informe sobre a data, horário e local da audiência, para que ela também possa se organizar com antecedência. Por gentileza, nos envie um print do aviso à testemunha.\n\nQualquer dúvida, estou à disposição! 🩵\n\nEquipe CS Lawyers ⚖️", "etapas": ["ativo"]},
  {"id": "oficial-reagendar", "titulo": "Reagendar consulta", "categoria": "Agendamento", "atalho": "reagendar", "texto": "Oi, {nome}! Tudo bem? 😊\n\nFique tranquila, sabemos que imprevistos acontecem.\n\nEstou passando para reagendarmos sua consulta e garantir que você receba a orientação necessária sobre o seu caso com calma e atenção.\n\nHoje temos disponibilidade às {horario1} ou às {horario2}.\n\nQual desses horários fica melhor para você?"},
  {"id": "oficial-confirmar", "titulo": "Confirmar atendimento de hoje", "categoria": "Agendamento", "atalho": "confirmar", "texto": "Olá, {nome}!\n\nBom dia! 😊\n\nPassando para confirmar o seu atendimento hoje às {horario} ✅\n\nEquipe CS Advocacia ⚖️\nLawyers"},
  {"id": "oficial-pericia", "titulo": "Perícia agendada pelo Tribunal", "categoria": "Processo", "atalho": "pericia", "texto": "📍 Atenção: Perícia Agendada pelo Tribunal!\n\n⚠️ Sua perícia foi marcada para:\n\n📆 Data: {data}\n⏰ Horário: {horario}\n📍 Endereço: {endereco}\n\n‼️ Lembramos que você deve estar presente no local com 15 minutos de antecedência do horário agendado.\n\nObrigada 😊\n\nEquipe CS Advocacia\nwww.carolinasantos.com.br", "etapas": ["ativo"]},
  {"id": "oficial-contrato", "titulo": "Contrato para assinatura (GOV)", "categoria": "Documentos", "atalho": "contrato", "texto": "Oi, {nome}! Tudo bem? 😊\n\nSegue o contrato para assinatura.\n\nAlguns lembretes importantes:\n\n📌 A assinatura deverá ser realizada por meio do *GOV Assinaturas*;\n\n📌 Caso prefira, a assinatura também poderá ser feita *à mão*. Nesse caso, basta imprimir o documento, assiná-lo, digitalizá-lo e nos enviar.\n\n📌 Assim que finalizar a assinatura, pedimos, por gentileza, que nos encaminhe o documento assinado novamente por aqui.\n\nCaso tenha qualquer dificuldade para realizar a assinatura, pode me chamar que eu te auxilio, tá bem? 💛\n\nFicaremos no aguardo para dar continuidade ao seu atendimento. 😊✅\n\n*Equipe CS Advocacia*\ncarolinasantos.com.br"},
  {"id": "oficial-ata", "titulo": "Ata da audiência", "categoria": "Processo", "atalho": "ata", "texto": "Oi, {nome}, boa tarde! 😊\n\nSegue em anexo a ata da audiência.\n\nO julgamento do processo ficou designado para o dia {data_julgamento}.\n\nLembrando também que essa ata pode ser utilizada para justificar sua ausência no trabalho, caso necessário.\n\nQualquer dúvida, pode me chamar 😊", "etapas": ["ativo"]},
  {"id": "oficial-docsiniciais", "titulo": "Documentos iniciais para o contrato", "categoria": "Documentos", "atalho": "docsiniciais", "texto": "Oi, {nome}! Tudo bem? 😊\n\nPara elaborarmos o seu contrato e darmos andamento ao seu caso, preciso que você nos encaminhe, por gentileza:\n\n📍 Documento pessoal com foto, podendo ser RG ou CNH\n📍 CPF, caso não conste no documento enviado\n📍 Comprovante de residência atualizado\n\nNa sequência, enviaremos a lista de documentos necessários e já iniciaremos o processo 😊\n\nFicamos no aguardo 🩵\n\n*Equipe CS Advocacia*\ncarolinasantos.com.br", "etapas": ["inicial"]},
  {"id": "oficial-lembreteconsulta", "titulo": "Lembrete da consulta de hoje", "categoria": "Agendamento", "atalho": "lembreteconsulta", "texto": "Oi, {nome}! Bom dia 😊\n\nPassando para lembrar que:\n\n📆 Sua consulta está confirmada para hoje, às {horario} ✅\n\nCaso precise fazer alguma alteração, pedimos a gentileza de nos avisar com pelo menos 1 hora de antecedência.\n\nEstamos te aguardando!\n\nEquipe CS Advocacia\ncarolinasantos.com.br"},
  {"id": "oficial-docstrabalhista", "titulo": "Documentos do caso trabalhista", "categoria": "Documentos", "atalho": "docstrabalhista", "texto": "Oi, {nome}! Tudo bem? 😊\n\nPara darmos andamento ao seu caso trabalhista com mais segurança, preciso que você nos encaminhe alguns documentos e informações importantes.\n\nPeço, por gentileza, que os documentos sejam enviados em *PDF*, sempre que possível. Caso não tenha algum deles, não tem problema, é só nos avisar, tá bem?\n\n📄 *DOCUMENTOS NECESSÁRIOS*\n\n📍 Carteira de Trabalho — CTPS, principalmente as páginas do contrato e anotações importantes\n📍 Contrato de trabalho, se houver\n📍 Recibos de pagamento, holerites ou contracheques do período trabalhado\n📍 Extrato do FGTS\n📍 Termo de Rescisão do Contrato de Trabalho — TRCT, caso tenha recebido\n📍 Comprovante de aviso-prévio, se houver\n📍 Guias do seguro-desemprego, se tiver recebido\n📍 Conversas, mensagens, e-mails, fotos, vídeos ou qualquer prova relacionada ao trabalho, se houver\n\n📝 *INFORMAÇÃO IMPORTANTE*\n\nPor gentileza, nos informe também se há testemunhas que possam confirmar a situação vivenciada no trabalho.\n\nAssim que recebermos os documentos e essa informação, conseguiremos analisar tudo com mais atenção e dar continuidade aos próximos passos do seu atendimento.\n\nQualquer dúvida, estamos à disposição para te auxiliar, tá bem? 😊\n\n*Equipe CS Advocacia*\ncarolinasantos.com.br", "etapas": ["documentos"]},
].map((r) => ({ ...r, padrao: true }) as QuickReply);

/** Mensagens padrão antigas, substituídas pela lista oficial; ajustes salvos delas não voltam a aparecer. */
export const RETIRED_DEFAULT_IDS = new Set(["cs-orcamento", "cs-reagendar", "cs-pericia", "cs-ata", "agendar", "andamento", "cancelado", "cancelar", "confirmado", "cs-boas-vindas", "cs-confirmar-hoje", "cs-contrato-gov", "cs-docs-contrato", "cs-docs-curto", "cs-docs-trabalhista", "cs-fora-horario", "cs-lembrete-consulta", "cs-pericia-amanha", "documentos", "entender", "faltam", "finalizar", "foto", "honorarios", "lembrar", "obrigada", "ola", "presencial", "recebido", "remarcar", "sem-novidades", "valor", "verificar"]);

export const emptySaved: SavedReplies = { itens: [], ocultas: [] };

/** Lista final: padrão (menos ocultas e substituídas) + mensagens da equipe, na ordem das categorias. */
export function mergeReplies(saved?: Partial<SavedReplies>): QuickReply[] {
  const itens = (saved?.itens ?? []).filter((r) => !RETIRED_DEFAULT_IDS.has(r.id));
  const ocultas = new Set(saved?.ocultas ?? []);
  const own = new Map(itens.map((r) => [r.id, r]));
  const base = DEFAULT_REPLIES.filter((r) => !ocultas.has(r.id)).map((r) => own.get(r.id) ?? r);
  const extra = itens.filter((r) => !DEFAULT_REPLIES.some((d) => d.id === r.id));
  const order = (c: ReplyCategory) => REPLY_CATEGORIES.indexOf(c);
  return [...base, ...extra].map((r, i) => ({ r, i })).sort((a, b) => order(a.r.categoria) - order(b.r.categoria) || a.i - b.i).map((x) => x.r);
}

/** Troca as variáveis conhecidas pelos dados do cliente. Campos livres (ex.: {data}) ficam para a atendente preencher. */
export function fillReply(texto: string, c: Pick<Conversa, 'nome' | 'atendimento' | 'documentos'>): string {
  const faltantes = c.documentos.filter((d) => !d.recebido).map((d) => d.nome);
  const values: Record<string, string> = {
    nome: c.nome.split(' ')[0] ?? c.nome,
    nome_completo: c.nome,
    documentos_faltantes: faltantes.length ? faltantes.join(', ') : 'nenhum documento pendente',
    atendimento: c.atendimento,
  };
  const primeiro = values['nome']?.trim() ?? '';
  // Sem nome conhecido: tira {nome} e a vírgula ao redor, sem deixar a frase quebrada.
  const base = primeiro && !/^novo contato$/i.test(c.nome.trim())
    ? texto
    : texto
        .replace(/\{nome\}, (\p{Ll})/gu, (_a, l: string) => l.toUpperCase())
        .replace(/ ?, \{nome\}([.!?,])/g, '$1')
        .replace(/\{nome\}([.!?]) ?/g, '')
        .replace(/\{nome\} ?/g, '');
  return base.replace(/\{([a-z_]+)\}/gi, (all, key: string) => values[key.toLowerCase()] ?? all);
}

/** Campos entre chaves que ainda precisam ser preenchidos antes de enviar. */
export function pendingFields(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\{([^{}\n]{1,40})\}/g)].map((m) => m[1]!))];
}

/** Até `limit` sugestões para a conversa: primeiro o que combina com a última mensagem, depois com a etapa. */
export function suggestedReplies(c: Pick<Conversa, 'etapa' | 'mensagens' | 'documentos'>, replies: QuickReply[], limit = 4): QuickReply[] {
  const first: string[] = [];
  const picked = [
    ...first.map((id) => replies.find((r) => r.id === id)),
    ...replies.filter((r) => r.etapas?.includes(c.etapa)),
  ].filter((r): r is QuickReply => Boolean(r));
  const unique = picked.filter((r, i) => picked.findIndex((x) => x.id === r.id) === i);
  const withoutUseless = unique.filter((r) => r.id !== 'faltam' || c.documentos.some((d) => !d.recebido));
  return withoutUseless.slice(0, limit);
}

/** Busca por título, atalho ou texto, sem diferenciar acentos e maiúsculas. Atalho exato vem primeiro. */
export function searchReplies(replies: QuickReply[], query: string): QuickReply[] {
  const q = normalized(query.replace(/^\//, ''));
  if (!q) return replies;
  const score = (r: QuickReply) => {
    const atalho = normalized(r.atalho);
    if (atalho === q) return 0;
    if (atalho.startsWith(q)) return 1;
    if (normalized(r.titulo).includes(q)) return 2;
    if (normalized(r.texto).includes(q)) return 3;
    return 9;
  };
  return replies.map((r) => ({ r, s: score(r) })).filter((x) => x.s < 9).sort((a, b) => a.s - b.s).map((x) => x.r);
}

export function cleanShortcut(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 20);
}

/** Valida a mensagem antes de salvar. Devolve a lista de problemas (vazia = ok). */
export function validateReply(reply: Pick<QuickReply, 'id' | 'titulo' | 'texto' | 'atalho'>, all: QuickReply[]): string[] {
  const errors: string[] = [];
  if (!reply.titulo.trim()) errors.push('Dê um nome para a mensagem.');
  if (!reply.texto.trim()) errors.push('Escreva o texto da mensagem.');
  if (reply.texto.length > 1500) errors.push('O texto pode ter até 1.500 caracteres.');
  if (!reply.atalho) errors.push('Defina um atalho, ex.: /bomdia.');
  else if (all.some((r) => r.id !== reply.id && r.atalho === reply.atalho)) errors.push(`O atalho /${reply.atalho} já está em uso.`);
  return errors;
}

export function upsertReply(saved: SavedReplies, reply: QuickReply): SavedReplies {
  const itens = saved.itens.some((r) => r.id === reply.id) ? saved.itens.map((r) => (r.id === reply.id ? reply : r)) : [...saved.itens, reply];
  return { ...saved, itens, ocultas: saved.ocultas.filter((id) => id !== reply.id) };
}

export function removeReply(saved: SavedReplies, id: string): SavedReplies {
  const isDefault = DEFAULT_REPLIES.some((r) => r.id === id);
  return { itens: saved.itens.filter((r) => r.id !== id), ocultas: isDefault ? [...new Set([...saved.ocultas, id])] : saved.ocultas };
}

/** Volta uma mensagem padrão ao texto original. */
export function restoreDefault(saved: SavedReplies, id: string): SavedReplies {
  return { itens: saved.itens.filter((r) => r.id !== id), ocultas: saved.ocultas.filter((x) => x !== id) };
}
