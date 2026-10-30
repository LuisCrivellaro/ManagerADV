import { it, expect } from 'vitest';
import { deadlineState, localDay } from '@/lib/dashboard';
it('distingue prazos vencidos, de hoje e futuros',()=>{
  expect(deadlineState('2026-10-18','2026-10-19')).toBe('Vencido');
  expect(deadlineState('2026-10-19','2026-10-19')).toBe('Hoje');
  expect(deadlineState('2026-10-20','2026-10-19')).toBe('A vencer');
});
it('utiliza a data local para prazos de dia inteiro',()=>{
  expect(localDay(new Date(2026,9,19,0,30))).toBe('2026-10-19');
});