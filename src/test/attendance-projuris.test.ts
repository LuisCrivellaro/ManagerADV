import { describe, expect, it } from 'vitest';
import { attendanceProcesses } from '@/lib/attendance-projuris';
import { conversas } from '@/lib/mock-data';
import type { OfficeCase } from '@/lib/office';

describe('selected conversation process records', () => {
  const c = conversas.find(c => c.nome === 'Helena Cardoso Prado');
  if (!c) throw new Error('Missing case fixture');
  it('shows saved processes without creating movements from status or timeline', () => {
    const processes = attendanceProcesses(c, {});
    expect(processes.map(p => p.cnj)).toEqual(['5004821-37.2026.4.03.6183', '1012334-08.2025.8.26.0100']);
    expect(processes.flatMap(p => p.movements)).toEqual([]);
  });
  it('deduplicates saved CNJ and keeps movements attached to their exact process', () => {
    const work: OfficeCase = { cnj: '5004821-37.2026.4.03.6183', movements: [
      { id: '1', cnj: '5004821-37.2026.4.03.6183', data: '2026-10-19', texto: 'Perícia', concluido: false },
      { id: '2', cnj: '1012334-08.2025.8.26.0100', data: '2026-10-18', texto: 'Pagamento', concluido: true },
    ] };
    const processes = attendanceProcesses(c, work);
    expect(processes).toHaveLength(2);
    expect(processes[0]?.movements.map(m => m.id)).toEqual(['1']);
    expect(processes[1]?.movements.map(m => m.id)).toEqual(['2']);
  });
  it('includes a process saved only in the current workspace', () => {
    expect(attendanceProcesses({ ...c, processos: [] }, { cnj: '123', vara: 'Vara local' })).toEqual([{ cnj: '123', vara: 'Vara local', movements: [] }]);
  });
});