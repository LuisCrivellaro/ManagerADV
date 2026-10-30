INSERT INTO public.user_roles(user_id, role)
SELECT u.id, r.role FROM auth.users u CROSS JOIN (VALUES ('advogada_senior'::public.app_role),('admin'::public.app_role)) r(role)
WHERE u.email='chamanalei@gmail.com'
AND NOT EXISTS (SELECT 1 FROM public.user_roles x WHERE x.user_id=u.id AND x.role=r.role);

UPDATE public.profiles SET cargo='Atendente Master (acesso total)' WHERE id IN (SELECT id FROM auth.users WHERE email='chamanalei@gmail.com');

CREATE OR REPLACE FUNCTION public.approve_material(p_case uuid, p_kind text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE work jsonb; v_owner uuid; v_super boolean; BEGIN
 v_super := public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'admin');
 IF NOT (v_super OR public.has_role(auth.uid(),'advogado_junior')) THEN RAISE EXCEPTION 'Aprovação reservada ao advogado sênior ou júnior'; END IF;
 IF p_kind NOT IN ('checklist','draft') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
 SELECT owner_id INTO v_owner FROM public.casos WHERE id=p_case AND (owner_id=auth.uid() OR v_super) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Caso indisponível'; END IF;
 SELECT dados->'casos'->p_case::text INTO work FROM public.office_workspace WHERE owner_id=v_owner FOR UPDATE;
 PERFORM 1 FROM public.checklist_itens WHERE caso_id=p_case AND owner_id=v_owner FOR UPDATE;
 IF p_kind='checklist' AND (NOT EXISTS(SELECT 1 FROM public.checklist_itens WHERE caso_id=p_case) OR EXISTS(SELECT 1 FROM public.checklist_itens WHERE caso_id=p_case AND NOT recebido)) THEN RAISE EXCEPTION 'Checklist incompleto'; END IF;
 IF p_kind='draft' AND (NOT public.material_approved(v_owner,p_case,'checklist') OR coalesce(trim(work->>'peticao'),'')='') THEN RAISE EXCEPTION 'A minuta exige checklist aprovado e texto salvo'; END IF;
 INSERT INTO public.legal_approvals(owner_id,caso_id,kind,revision,approved_by) VALUES(v_owner,p_case,p_kind,public.material_revision(v_owner,p_case,p_kind),auth.uid()); END; $function$;

CREATE OR REPLACE FUNCTION public.material_status(p_case uuid)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ DECLARE v_owner uuid; v_super boolean; BEGIN
 v_super := public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'admin');
 SELECT owner_id INTO v_owner FROM public.casos WHERE id=p_case AND (owner_id=auth.uid() OR v_super);
 IF NOT FOUND THEN RAISE EXCEPTION 'Caso indisponível'; END IF;
 RETURN jsonb_build_object('checklist',public.material_approved(v_owner,p_case,'checklist'),'draft',public.material_approved(v_owner,p_case,'draft'),'canApprove',v_super OR public.has_role(auth.uid(),'advogado_junior')); END; $function$;