import { describe, it, expect } from 'vitest';
import { canApproveMaterial, canAdvance, canViewOffice } from '@/lib/approval-rules';
describe('Aprovação jurídica obrigatória', () => {
  it('permite aprovação apenas a sênior ou júnior', () => {
    expect(canApproveMaterial(['advogada_senior'])).toBe(true);
    expect(canApproveMaterial(['advogado_junior'])).toBe(true);
    expect(canApproveMaterial(['admin'])).toBe(true);
    for (const role of ['atendente','operacoes']) expect(canApproveMaterial([role])).toBe(false);
  });
  it('bloqueia produção até aprovação de checklist', () => {
    expect(canAdvance(3,{checklist:false,draft:true})).toBe(false);
    expect(canAdvance(3,{checklist:true,draft:false})).toBe(true);
  });
  it('bloqueia auditoria e protocolo até aprovação de ambos', () => {
    for (const stage of [4,5,6,7,8,9]) {
      expect(canAdvance(stage,{checklist:true,draft:false})).toBe(false);
      expect(canAdvance(stage,{checklist:false,draft:true})).toBe(false);
      expect(canAdvance(stage,{checklist:true,draft:true})).toBe(true);
    }
  });
  it('restringe visão integral à sênior e administração', () => {
    expect(canViewOffice(['advogada_senior'])).toBe(true);
    expect(canViewOffice(['admin'])).toBe(true);
    expect(canViewOffice(['atendente'])).toBe(false);
    expect(canViewOffice(['advogado_junior'])).toBe(false);
  });
});