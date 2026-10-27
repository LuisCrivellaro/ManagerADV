import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useCalendarQuickReply } from '@/hooks/use-calendar-quick-reply';
import type { QuickReply } from '@/lib/respostas-prontas';
const r: QuickReply = { id: 'consulta', atalho: 'consulta', titulo: 'Consulta', texto: '{horario1} {horario2}', categoria: 'Agendamento' };
describe('Inserção manual com consulta assíncrona', () => {
  it('seleção repetida consulta e insere uma única vez, sem efeito externo', async () => {
    let done: ((v: {}) => void) | undefined;
    const load = vi.fn(() => new Promise<{}>(resolve => { done = resolve; }));
    const insert = vi.fn(), notify = vi.fn();
    const { result } = renderHook(() => useCalendarQuickReply(load, insert, notify));
    let pending: Promise<void> | undefined;
    act(() => { pending = result.current.pick(r); void result.current.pick(r); });
    expect(result.current.loading).toBe(true); expect(load).toHaveBeenCalledTimes(1); expect(insert).not.toHaveBeenCalled();
    await act(async () => { done?.({}); await pending; });
    expect(insert).toHaveBeenCalledTimes(1); expect(result.current.loading).toBe(false);
  });
  it('falha preserva campos para edição manual', async () => {
    const insert = vi.fn(), notify = vi.fn();
    const { result } = renderHook(() => useCalendarQuickReply(vi.fn().mockRejectedValue(new Error('offline')), insert, notify));
    await act(async () => { await result.current.pick(r); });
    expect(insert).toHaveBeenCalledWith(r); expect(notify).toHaveBeenCalledTimes(1);
  });
  it('troca de conversa descarta resposta antiga', async () => {
    let done: ((v: {}) => void) | undefined;
    const insert = vi.fn(); const { result, unmount } = renderHook(() => useCalendarQuickReply(() => new Promise<{}>(resolve => { done = resolve; }), insert, vi.fn()));
    let pending: Promise<void> | undefined;
    act(() => { pending = result.current.pick(r); }); unmount();
    await act(async () => { done?.({}); await pending; });
    expect(insert).not.toHaveBeenCalled();
  });
});