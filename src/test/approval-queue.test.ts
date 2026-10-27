import { describe, it, expect } from 'vitest';
import { draftStatus, reviewPriority } from '@/lib/approval-queue';
describe('Fila de minutas', () => {
  it('uma aprovação antiga não libera a versão atual', () => {
    expect(draftStatus({ draftApproved: false, checklistApproved: true, previousApproval: true })).toBe('Nova aprovação necessária');
  });
  it('checklist não aprovado mantém a minuta bloqueada', () => {
    expect(draftStatus({ draftApproved: false, checklistApproved: false, previousApproval: false })).toBe('Checklist pendente');
  });
  it('prioriza pendentes vencidas, hoje, futuras e sem prazo antes das aprovadas', () => {
    const today = '2026-10-19';
    expect(reviewPriority({ dueDate: '2026-10-18', draftApproved: false }, today)).toBe(0);
    expect(reviewPriority({ dueDate: today, draftApproved: false }, today)).toBe(1);
    expect(reviewPriority({ dueDate: '2026-10-20', draftApproved: false }, today)).toBe(2);
    expect(reviewPriority({ dueDate: null, draftApproved: false }, today)).toBe(3);
    expect(reviewPriority({ dueDate: '2026-10-18', draftApproved: true }, today)).toBe(4);
  });
});