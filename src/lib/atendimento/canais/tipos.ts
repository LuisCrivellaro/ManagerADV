// Tipos da camada de canais do Atendimento. Telas, fila e regras não dependem de um canal específico.

export type NomeCanal = 'telegram' | 'simulador' | 'ultramsg';

export interface MensagemEntrada {
  canal: NomeCanal;
  idExterno: string;
  /** chat_id do Telegram ou telefone no WhatsApp. */
  contatoExterno: string;
  /** Telefone real ou fictício usado pelo resto do sistema. */
  telefone: string;
  nomeContato: string;
  tipo: 'texto' | 'audio' | 'arquivo' | 'imagem';
  texto: string;
  mediaRef?: string;
  recebidoEm: string;
}

export interface ResultadoEnvio {
  ok: boolean;
  idExterno?: string;
  erro?: string;
}

export interface ReferenciaCanal {
  /** Credencial do canal, fornecida apenas pelo servidor. */
  token?: string;
  /** Botões clicáveis (Telegram), um por linha. */
  botoes?: { texto: string; dados: string }[];
}

export interface AdaptadorCanal {
  nome: NomeCanal;
  enviarTexto(contatoExterno: string, texto: string, referencia?: ReferenciaCanal): Promise<ResultadoEnvio>;
}
