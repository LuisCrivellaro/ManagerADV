CREATE TABLE public.draft_review_assignments (
 caso_id uuid PRIMARY KEY REFERENCES public.casos(id) ON DELETE CASCADE,
 lawyer_id uuid,
 due_date date,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.draft_review_assignments TO authenticated;
GRANT ALL ON public.draft_review_assignments TO service_role;
ALTER TABLE public.draft_review_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read review assignments" ON public.draft_review_assignments FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.casos c WHERE c.id=caso_id AND c.owner_id=auth.uid()) OR public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'admin'));

CREATE FUNCTION public.draft_approval_queue() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE wide boolean; rows jsonb; lawyers jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação obrigatória'; END IF;
 wide := public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'admin');
 SELECT coalesce(jsonb_agg(jsonb_build_object(
 'id',c.id,'name',c.nome,'ownerId',c.owner_id,'ownerName',coalesce(nullif(p.nome,''),'Equipe'),
 'lawyerId',a.lawyer_id,'dueDate',a.due_date,'draft',w.dados->'casos'->c.id::text->>'peticao',
 'checklistApproved',public.material_approved(c.owner_id,c.id,'checklist'),
 'draftApproved',public.material_approved(c.owner_id,c.id,'draft'),
 'previousApproval',EXISTS(SELECT 1 FROM public.legal_approvals ap WHERE ap.caso_id=c.id AND ap.kind='draft'),
 'updatedAt',greatest(c.updated_at,w.updated_at), 'mine',c.owner_id=auth.uid()
 ) ORDER BY c.nome),'[]'::jsonb) INTO rows
 FROM public.casos c JOIN public.office_workspace w ON w.owner_id=c.owner_id
 LEFT JOIN public.profiles p ON p.id=c.owner_id LEFT JOIN public.draft_review_assignments a ON a.caso_id=c.id
 WHERE (wide OR c.owner_id=auth.uid()) AND coalesce(trim(w.dados->'casos'->c.id::text->>'peticao'),'')<>'';
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',coalesce(nullif(p.nome,''),'Advogado')) ORDER BY p.nome),'[]'::jsonb) INTO lawyers
 FROM public.profiles p WHERE EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role IN ('advogada_senior','advogado_junior'));
 RETURN jsonb_build_object('entireOffice',wide,'rows',rows,'lawyers',lawyers,'updatedAt',now());
END; $$;
REVOKE ALL ON FUNCTION public.draft_approval_queue() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.draft_approval_queue() TO authenticated;

CREATE FUNCTION public.schedule_draft_review(p_case uuid,p_lawyer uuid DEFAULT NULL,p_due date DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.casos c WHERE c.id=p_case AND (c.owner_id=auth.uid() OR public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'admin'))) THEN RAISE EXCEPTION 'Caso indisponível'; END IF;
 IF p_lawyer IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=p_lawyer AND role IN ('advogada_senior','advogado_junior')) THEN RAISE EXCEPTION 'Responsável deve ser advogado sênior ou júnior'; END IF;
 INSERT INTO public.draft_review_assignments(caso_id,lawyer_id,due_date) VALUES(p_case,p_lawyer,p_due)
 ON CONFLICT(caso_id) DO UPDATE SET lawyer_id=EXCLUDED.lawyer_id,due_date=EXCLUDED.due_date,updated_at=now();
END; $$;
REVOKE ALL ON FUNCTION public.schedule_draft_review(uuid,uuid,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.schedule_draft_review(uuid,uuid,date) TO authenticated;