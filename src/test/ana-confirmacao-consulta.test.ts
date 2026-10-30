import { describe, expect, it } from 'vitest';
import { mensagemConfirmacaoAna } from '@/lib/atendimento/ana-scheduling';

const INICIO = '2026-10-30T18:00:00.000Z'; // sexta-feira, 15h de Brasília
const LINK = 'https://meet.google.com/csk-dywz-oft';

describe('mensagem de agendamento confirmada', () => {
  it('usa o formato oficial: horário, linha em branco e link do Meet', () => {
    expect(mensagemConfirmacaoAna(INICIO, LINK)).toBe(
      'Sua consulta está confirmada para Sexta-feira, 30/10, às 15h\n\nAcesse a reunião: https://meet.google.com/csk-dywz-oft',
    );
  });

  it('confirma só o horário quando a agenda não devolveu um link real', () => {
    expect(mensagemConfirmacaoAna(INICIO)).toBe('Sua consulta está confirmada para Sexta-feira, 30/10, às 15h');
    expect(mensagemConfirmacaoAna(INICIO, 'http://meet.google.com/csk-dywz-oft')).toBe(
      'Sua consulta está confirmada para Sexta-feira, 30/10, às 15h',
    );
  });
});
