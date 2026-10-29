// Erro do ProJuris sem dados do cliente nem credenciais. Arquivo neutro: usado pelo servidor e pelo simulador.
export type TipoErroProjuris = 'configuracao' | 'autenticacao' | 'sem_permissao' | 'limite' | 'indisponivel' | 'tempo' | 'resposta';

/** "sem_permissao" (403) deve ser registrado e avisado, nunca contornado. */
export class ErroProjuris extends Error {
  readonly tipo: TipoErroProjuris;
  readonly status: number | undefined;
  constructor(tipo: TipoErroProjuris, mensagem: string, status?: number) {
    super(mensagem);
    this.name = 'ErroProjuris';
    this.tipo = tipo;
    this.status = status;
  }
}
