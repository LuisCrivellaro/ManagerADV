import { describe, it, expect } from 'vitest';
import { SAUDACAO_CLIENTE_NOVO, apenasCumprimentoAna, saudacaoClienteNovo, type AnaResult } from '@/lib/atendimento/ana-rules';
import { listaHorariosAna } from '@/lib/atendimento/ana-scheduling';

const r = (extra: Partial<AnaResult> = {}): AnaResult => ({ acao: 'enviar', mensagem: 'texto do modelo', motivo_aprovacao: '', intencao: 'duvida_geral', urgente: false, encaminhar_humano: false, dados_coletados: { nome: '', cpf: '', assunto: '', email: '' }, proximo_passo: '', ...extra });

describe('Saudação oficial do cliente novo (30/10/2026)', () => {
  it('texto exato definido pela Dra.', () => {
    expect(SAUDACAO_CLIENTE_NOVO).toBe('Olá!\n\nSeja bem-vindo(a)! 😊\n\nEquipe CS Advocacia\nwww.carolinasantos.com.br\n\nVou te ajudar!\n\nNossa primeira consulta é on-line e gratuita.\n\nComo podemos te ajudar?');
  });
  it('reconhece só cumprimentos, com ou sem pontuação e emoji', () => {
    for (const t of ['oi', 'Olá!', 'boa tarde', 'Oi, boa noite! tudo bem?', 'bom dia 😊', 'opa', 'e aí']) expect(apenasCumprimentoAna(t), t).toBe(true);
    for (const t of ['oi, quero agendar', 'boa tarde, preciso de ajuda com um processo', 'ok', '', '??']) expect(apenasCumprimentoAna(t), t).toBe(false);
  });
  it('cliente novo que só cumprimenta recebe a saudação exata', () => {
    expect(saudacaoClienteNovo(r(), 'boa tarde', { apresentado: false, tipoCliente: undefined }).mensagem).toBe(SAUDACAO_CLIENTE_NOVO);
    expect(saudacaoClienteNovo(r(), 'oi', { apresentado: false, tipoCliente: 'novo' }).mensagem).toBe(SAUDACAO_CLIENTE_NOVO);
  });
  it('não troca: já apresentado, cliente cadastrado, pedido já feito, passagem para a equipe ou rascunho', () => {
    expect(saudacaoClienteNovo(r(), 'oi', { apresentado: true }).mensagem).toBe('texto do modelo');
    expect(saudacaoClienteNovo(r(), 'oi', { apresentado: false, tipoCliente: 'cadastrado' }).mensagem).toBe('texto do modelo');
    expect(saudacaoClienteNovo(r(), 'oi, quero agendar uma consulta', { apresentado: false }).mensagem).toBe('texto do modelo');
    expect(saudacaoClienteNovo(r({ encaminhar_humano: true }), 'oi', { apresentado: false }).mensagem).toBe('texto do modelo');
    expect(saudacaoClienteNovo(r({ acao: 'rascunho' }), 'oi', { apresentado: false }).mensagem).toBe('texto do modelo');
  });
});

describe('Lista de horários numerada (30/10/2026)', () => {
  const agora = new Date('2026-11-06T12:00:00-03:00');
  const slots = ['2026-11-09T09:00:00-03:00', '2026-11-10T13:00:00-03:00', '2026-11-11T09:00:00-03:00'];
  it('"outras opções" no formato pedido pela Dra.', () => {
    expect(listaHorariosAna(slots, agora, true)).toBe('Tenho estas outras opções:\n\n🗓️ Outras opções (30 min, horário de Brasília):\n1. Seg, 09/11 · 9h às 9h30\n2. Ter, 10/11 · 13h às 13h30\n3. Qua, 11/11 · 9h às 9h30\n\nQual fica melhor para você? Se preferir, me diga outro dia ou horário.');
  });
  it('primeira lista também numerada, sem pedir "responda com o número"', () => {
    const t = listaHorariosAna(slots, agora);
    expect(t).toMatch(/^Claro! Seguem os horários livres/);
    expect(t).toMatch(/^1\. Seg, 09\/11 · 9h às 9h30$/m);
    expect(t).not.toMatch(/Responda com o número/);
  });
});
