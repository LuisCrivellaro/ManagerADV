export interface ApprovalQueueRow {
  id: string; name: string; ownerId: string; ownerName: string;
  lawyerId: string | null; dueDate: string | null; draft: string;
  checklistApproved: boolean; draftApproved: boolean; previousApproval: boolean;
  updatedAt: string; mine: boolean;
}
export interface ApprovalQueueData {
  entireOffice: boolean; rows: ApprovalQueueRow[];
  lawyers: { id: string; name: string }[]; updatedAt: string;
}
export function draftStatus(row: Pick<ApprovalQueueRow, 'draftApproved' | 'checklistApproved' | 'previousApproval'>) {
  if (row.draftApproved) return 'Aprovada';
  if (!row.checklistApproved) return 'Checklist pendente';
  return row.previousApproval ? 'Nova aprovação necessária' : 'Aguardando aprovação';
}
export function reviewPriority(row: Pick<ApprovalQueueRow, 'dueDate' | 'draftApproved'>, today: string) {
  if (row.draftApproved) return 4;
  if (!row.dueDate) return 3;
  if (row.dueDate < today) return 0;
  if (row.dueDate === today) return 1;
  return 2;
}