// Dados fictícios — nenhum dado real de cliente.
export type Etapa = "inicial" | "documentos" | "ativo";
export const etapaLabel: Record<Etapa, string> = { inicial: "Atendimento inicial", documentos: "Coleta de documentos", ativo: "Cliente ativo" };

export const PIPELINE = ["Atendimento inicial", "Contrato assinado", "Coleta de documentos", "Produção", "Auditoria IA", "Auditoria humana", "Autuação", "Protocolo", "Cadastro ProJuris", "Andamentos"];
export type Sync = "sincronizado" | "pendente" | "erro";

export interface Mensagem {
  pdfStart?: { id: string; url: string; nome: string; tipoDocumento: string; descricao: string; bytes: number } | undefined;
  pendenciaPdf?: string | undefined;
  analiseDocumento?: import('./documentos-rules').ResultadoAnalise | undefined; checklistAtualizado?: boolean | undefined; pendenciaChecklist?: string | undefined; erroAnalise?: string | undefined;
  canal?: string; idExterno?: string | undefined; respostaAnaDe?: string;
  id: string; de: "cliente" | "escritorio" | "sistema"; texto: string; hora: string;
  iaProcessada?: boolean; automacaoKey?: string; dataHora?: string | undefined; autor?: string | undefined; tipoIdentificado?: string | undefined; confirmarTipo?: boolean | undefined; path?: string | undefined; driveUrl?: string | undefined;
  tipo?: "texto" | "documento" | "audio" | "imagem"; arquivo?: string | undefined; salvoStart?: boolean | undefined;
  /** Situação da mensagem do escritório no canal: simulada (canal desligado), enviada, entregue ou lida. Só avança com confirmação do canal. */
  status?: StatusMensagem | undefined;
}
export type StatusMensagem = "simulada" | "enviada" | "entregue" | "lida";
export interface Processo { cnj: string; vara: string; status: string; homologado: boolean }
export interface DocItem { id?: string | undefined; nome: string; recebido: boolean }
export interface Conversa {
  email?: string | undefined;
  etiquetaAcao?: import('./atendimento/intake-rules').EtiquetaAcao | undefined;
  pastaDrive?: { id: string; url: string } | undefined;
  tipoClienteAgenda?: import('./atendimento/intake-rules').TipoCliente;
  agenteAna?: import('./atendimento/ana-rules').AnaState;
  id: string; nome: string; cpf: string; telefone: string; atendimento: string; etapa: Etapa;
  naoLidas: number; etapaPipeline: number; syncs: Sync[]; processos: Processo[];
  documentos: DocItem[]; mensagens: Mensagem[]; contrato?: "gerado" | "enviado" | "visualizado" | "assinado";
  consulta?: { duracao: string; resumo: string; transcricao: string };
  timeline: { data: string; evento: string }[];
  lidoAte?: string | undefined; modoIA?: import('./atendimento').AIMode | undefined; iaRetida?: string | undefined; horariosOfertados?: string[];
  consultaAgendada?: string | undefined; retornoAgendado?: string | undefined; retornoDuracao?: number | undefined; contratoLink?: string | undefined; contratoEnviadoEm?: string | undefined;
  ultimoPedidoDocumentos?: string | undefined; videoLink?: string | undefined; automacoesExecutadas?: string[]; tituloCaso?: string | undefined;
}

const docsBase = (r: boolean[]): DocItem[] =>
  ["RG ou CNH", "CPF", "Comprovante de residência", "Carteira de trabalho (CTPS)", "Extrato CNIS", "Laudos médicos"].map((nome, i) => ({ nome, recebido: r[i] ?? false }));

export const conversas: Conversa[] = [
  {
    id: "c1", nome: "Mariana Albuquerque Teixeira", cpf: "412.887.330-15", telefone: "(11) 98812-4471", atendimento: "AT-2026-0418",
    etapa: "documentos", naoLidas: 2, etapaPipeline: 2, syncs: ["sincronizado", "sincronizado", "pendente"], contrato: "assinado",
    processos: [], documentos: docsBase([true, true, true, false, true, false]),
    consulta: { duracao: "38:12", resumo: "Cliente trabalhou 9 anos como auxiliar de produção, afastada por LER/DORT desde 03/2025. Benefício por incapacidade negado pelo INSS em 08/2026. Tese: restabelecimento de auxílio por incapacidade temporária com conversão em aposentadoria por incapacidade permanente.", transcricao: "Dra. Carolina: Boa tarde, Mariana. Pode me contar desde quando sente as dores?\nMariana: Desde o começo de 2025, doutora. Primeiro no punho, depois no ombro…" },
    timeline: [{ data: "02/10/2026", evento: "Primeiro contato via WhatsApp" }, { data: "06/10/2026", evento: "Consulta inicial realizada (gravada)" }, { data: "08/10/2026", evento: "Contrato assinado via ZapSign" }, { data: "09/10/2026", evento: "Pasta criada no Google Drive" }],
    mensagens: [
      { id: "m1", de: "escritorio", texto: "Olá, Mariana! Aqui é a assessora da Dra. Carolina Santos. Para darmos andamento ao seu caso, precisamos dos documentos da lista abaixo.", hora: "09:12" },
      { id: "m2", de: "cliente", texto: "Bom dia! Vou mandar agora o que eu tenho aqui", hora: "10:03" },
      { id: "m3", de: "cliente", texto: "", tipo: "documento", arquivo: "RG_Mariana.pdf", salvoStart: true, hora: "10:04" },
      { id: "m4", de: "cliente", texto: "", tipo: "documento", arquivo: "comprovante_residencia.jpg", salvoStart: true, hora: "10:05" },
      { id: "m5", de: "cliente", texto: "A carteira de trabalho tá com meu marido, mando amanhã. Os laudos preciso pegar no posto, pode ser?", hora: "10:07" },
    ],
  },
  {
    id: "c2", nome: "Rogério Batista Nunes", cpf: "305.119.428-60", telefone: "(21) 99731-0582", atendimento: "AT-2026-0425",
    etapa: "inicial", naoLidas: 1, etapaPipeline: 0, syncs: [], processos: [], documentos: docsBase([]), timeline: [{ data: "19/10/2026", evento: "Primeiro contato via WhatsApp" }],
    mensagens: [
      { id: "m1", de: "cliente", texto: "Boa tarde. Fui demitido semana passada e não pagaram minha rescisão. A doutora atende trabalhista?", hora: "16:41" },
    ],
  },
  {
    id: "c3", nome: "Helena Cardoso Prado", cpf: "198.204.557-02", telefone: "(31) 98455-2290", atendimento: "AT-2026-0377",
    etapa: "ativo", naoLidas: 0, etapaPipeline: 9, syncs: ["sincronizado", "sincronizado", "sincronizado", "sincronizado", "sincronizado", "sincronizado", "sincronizado", "sincronizado", "sincronizado"], contrato: "assinado",
    processos: [
      { cnj: "5004821-37.2026.4.03.6183", vara: "3ª Vara Previdenciária de São Paulo", status: "Aguardando perícia médica marcada pelo juiz", homologado: false },
      { cnj: "1012334-08.2025.8.26.0100", vara: "12ª Vara Cível do Foro Central", status: "Acordo aprovado pelo juiz, aguardando pagamento", homologado: true },
    ],
    documentos: docsBase([true, true, true, true, true, true]),
    timeline: [{ data: "14/07/2026", evento: "Contrato assinado" }, { data: "02/09/2026", evento: "Petição protocolada" }, { data: "15/10/2026", evento: "Perícia designada para 11/11/2026" }],
    mensagens: [
      { id: "m1", de: "escritorio", texto: "Helena, sua perícia foi marcada para 11/11/2026 às 14h30, no Fórum Previdenciário (Av. Paulista, 1682). Leve documento com foto e todos os laudos.", hora: "Ontem" },
      { id: "m2", de: "cliente", texto: "Obrigada! Posso levar acompanhante?", hora: "Ontem" },
      { id: "m3", de: "escritorio", texto: "Pode sim. 🙂", hora: "Ontem" },
    ],
  },
  {
    id: "c4", nome: "Paulo Henrique Siqueira", cpf: "667.903.214-88", telefone: "(41) 99120-7735", atendimento: "AT-2026-0421",
    etapa: "inicial", naoLidas: 0, etapaPipeline: 0, syncs: [], processos: [], documentos: docsBase([]), contrato: "enviado",
    timeline: [{ data: "15/10/2026", evento: "Primeiro contato" }, { data: "17/10/2026", evento: "Consulta inicial" }, { data: "18/10/2026", evento: "Contrato enviado para assinatura" }],
    consulta: { duracao: "24:50", resumo: "Revisão de aposentadoria — período rural de 1988 a 1996 não reconhecido.", transcricao: "Paulo: Trabalhei na roça com meu pai até 96…" },
    mensagens: [
      { id: "m1", de: "escritorio", texto: "Paulo, enviamos o contrato para assinatura digital. É só abrir o link e seguir as instruções.", hora: "18/10" },
      { id: "m2", de: "cliente", texto: "", tipo: "audio", arquivo: "Áudio 0:42", hora: "18/10" },
    ],
  },
  {
    id: "c5", nome: "Juliana Moreira Lacerda", cpf: "520.348.771-93", telefone: "(11) 97644-1308", atendimento: "AT-2026-0402",
    etapa: "documentos", naoLidas: 0, etapaPipeline: 2, syncs: ["sincronizado", "erro"], contrato: "assinado",
    processos: [], documentos: docsBase([true, true, false, false, false, true]),
    timeline: [{ data: "28/09/2026", evento: "Contrato assinado" }],
    mensagens: [{ id: "m1", de: "cliente", texto: "", tipo: "imagem", arquivo: "laudo_ortopedista.jpg", salvoStart: true, hora: "Sex" }],
  },
];

export const naoPodeDizer = ["garantia de resultado", "prazo de pagamento", "valor da causa", "honorários", "ganhar"];
export const sugestoesIA: Record<string, string> = {
  c1: "Pode sim, Mariana! Envie a carteira de trabalho assim que possível. Os laudos são essenciais para comprovar a incapacidade — quando conseguir no posto, é só fotografar todas as páginas e mandar por aqui.",
  c2: "Boa tarde, Rogério! Sim, a Dra. Carolina atende casos trabalhistas. Vou te enviar alguns horários para uma conversa inicial com ela, tudo bem?",
  c3: "Fique tranquila, Helena. Qualquer dúvida antes da perícia, estou à disposição.",
  c4: "Paulo, recebi seu áudio. Você consegue garantia de que vai ganhar esse caso, o período rural é bem aceito.",
  c5: "Juliana, recebemos o laudo. Ainda faltam o comprovante de residência e a carteira de trabalho.",
};
