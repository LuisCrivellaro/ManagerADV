import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { ApprovalQueueData } from './approval-queue';

export const readApprovalQueue = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
    const result = await context.supabase.rpc('draft_approval_queue');
    if (result.error) throw new Error('Não foi possível carregar as aprovações.');
    return result.data as unknown as ApprovalQueueData;
  });
export const scheduleDraftReview = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ caseId: z.string().uuid(), lawyerId: z.string().uuid().nullable(), dueDate: z.iso.date().nullable() }))
  .handler(async ({ data, context }) => {
    const result = await context.supabase.rpc('schedule_draft_review', {
      p_case: data.caseId,
      ...(data.lawyerId ? { p_lawyer: data.lawyerId } : {}),
      ...(data.dueDate ? { p_due: data.dueDate } : {}),
    });
    if (result.error) throw new Error(result.error.message);
    return { ok: true };
  });