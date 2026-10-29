import { describe, it, expect } from 'vitest';
import { numeroWhatsApp, textoComOpcoes } from '@/lib/atendimento/canais/ultramsg';
import { listaHorariosAna } from '@/lib/atendimento/ana-scheduling';
import { botoesHorarios } from '@/lib/atendimento/botoes-horario';
import { formatarHorarioCliente } from '@/lib/atendimento';
import { mensagemDoSistema } from '@/lib/atendimento/entrada-whatsapp';

const agora = new Date('2026-10-29T12:00:00-03:00');
const slots = ['2026-11-03T09:30:00-03:00', '2026-11-04T09:00:00-03:00', '2026-11-05T14:00:00-03:00'];
const semNumeros = (t: string) => !/Responda com o número/.test(t) && !/^\s*\d+[.)]\s/m.test(t);

describe('UltraMsg', () => {
  it('extrai o número do remetente', () => { expect(numeroWhatsApp('5511999990001@c.us')).toBe('5511999990001'); });

  it('horários da Ana saem uma única vez, com marcadores e sem pedir número', () => {
    const texto = listaHorariosAna(slots, agora);
    const enviado = textoComOpcoes(texto, botoesHorarios(slots));
    expect(enviado).toBe(texto);
    expect(enviado.match(/03\/11/g)).toHaveLength(1);
    expect(semNumeros(enviado)).toBe(true);
  });

  it('horários de hoje e de amanhã também são reconhecidos no texto da Ana', () => {
    const proximos = ['2026-10-29T15:30:00-03:00', '2026-10-30T13:30:00-03:00'];
    const texto = listaHorariosAna(proximos, agora);
    expect(texto).toContain('Hoje');
    expect(textoComOpcoes(texto, botoesHorarios(proximos))).toBe(texto);
  });

  it('mensagem da equipe com os horários já escritos não é alterada', () => {
    const texto = `Olá! Tenho estes horários:\n${slots.map(s => `• ${formatarHorarioCliente(s)}`).join('\n')}`;
    expect(textoComOpcoes(texto, botoesHorarios(slots))).toBe(texto);
  });

  it('horário que faltar no texto entra ao final com marcador, sem número', () => {
    const enviado = textoComOpcoes('Tenho estes horários:', botoesHorarios(slots));
    for (const s of slots) expect(enviado).toContain(`• ${formatarHorarioCliente(s)}`);
    expect(enviado).not.toContain('🗓️');
    expect(semNumeros(enviado)).toBe(true);
  });

  it('acrescenta só o que falta e não confunde 9h com 19h nem com o fim de outro horário', () => {
    const texto = `Opções:\n• Ter, 03/11 · 9h30 às 10h\n• Qua, 04/11 · 19h às 19h30`;
    const enviado = textoComOpcoes(texto, botoesHorarios(['2026-11-03T09:30:00-03:00', '2026-11-04T09:00:00-03:00', '2026-11-03T10:00:00-03:00']));
    expect(enviado.match(/03\/11/g)).toHaveLength(2);
    expect(enviado).toContain(`• ${formatarHorarioCliente('2026-11-04T09:00:00-03:00')}`);
    expect(enviado).toContain(`• ${formatarHorarioCliente('2026-11-03T10:00:00-03:00')}`);
    expect(enviado).not.toContain(`• ${formatarHorarioCliente('2026-11-03T09:30:00-03:00')}`);
  });

  it('sem horários, o texto segue como está', () => {
    expect(textoComOpcoes('Olá!', undefined)).toBe('Olá!');
    expect(textoComOpcoes('Olá!', [])).toBe('Olá!');
  });

  it('o eco da mensagem enviada continua reconhecido como do sistema (não pausa a Ana)', () => {
    const guardado = 'Tenho estes horários:';
    const eco = textoComOpcoes(guardado, botoesHorarios(slots));
    const conversa = { mensagens: [{ de: 'escritorio' as const, texto: guardado, dataHora: '2026-10-29T14:59:00Z' }] };
    expect(mensagemDoSistema(eco, conversa, new Date('2026-10-29T15:00:00Z'))).toBe(true);
  });
});
