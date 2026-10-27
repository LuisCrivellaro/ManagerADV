export function canApproveMaterial(roles: string[]) {
  return roles.some(role => role === 'advogada_senior' || role === 'advogado_junior' || role === 'admin');
}
export function canViewOffice(roles: string[]) {
  return roles.some(role => role === 'advogada_senior' || role === 'admin');
}
export function canAdvance(stage: number, approvals: { checklist: boolean; draft: boolean }) {
  return (stage < 3 || approvals.checklist) && (stage < 4 || approvals.draft);
}
