ALTER TABLE public.legal_approvals DROP CONSTRAINT legal_approvals_kind_check;
ALTER TABLE public.legal_approvals ADD CONSTRAINT legal_approvals_kind_check CHECK (kind IN ('audit','protocol','checklist','draft'));
ALTER TABLE public.legal_approvals ADD COLUMN approved_by uuid;
CREATE OR REPLACE FUNCTION public.material_revision(p_owner uuid,p_case uuid,p_kind text) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT md5(CASE WHEN p_kind='checklist' THEN jsonb_build_object('items',(SELECT jsonb_agg(jsonb_build_object('id',id,'nome',nome,'recebido',recebido) ORDER BY ordem,id) FROM public.checklist_itens WHERE caso_id=p_case AND owner_id=p_owner),'files',coalesce(w.dados->'casos'->p_case::text->'arquivos','[]'::jsonb))::text ELSE jsonb_build_object('checklist',public.material_revision(p_owner,p_case,'checklist'),'case',c.dados - 'etapaPipeline' - 'syncs' - 'timeline' - 'mensagens','work',(coalesce(w.dados->'casos'->p_case::text,'{}'::jsonb) - 'fase' - 'historico' - 'movements' - 'versoes' - 'cnj' - 'recibo' - 'protocoloData' - 'tribunal' - 'vara' - 'classe' - 'revisao' - 'relatorio' - 'novosFatos'))::text END) FROM public.casos c LEFT JOIN public.office_workspace w ON w.owner_id=c.owner_id WHERE c.id=p_case AND c.owner_id=p_owner;
$$;
REVOKE ALL ON FUNCTION public.material_revision(uuid,uuid,text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.material_approved(p_owner uuid,p_case uuid,p_kind text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.legal_approvals a WHERE a.owner_id=p_owner AND a.caso_id=p_case AND a.kind=p_kind AND a.revision=public.material_revision(p_owner,p_case,p_kind) AND EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=a.approved_by AND r.role IN ('advogada_senior','advogado_junior'))); $$;
REVOKE ALL ON FUNCTION public.material_approved(uuid,uuid,text) FROM PUBLIC;
CREATE OR REPLACE FUNCTION public.material_status(p_case uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.casos WHERE id=p_case AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Caso indisponível'; END IF; RETURN jsonb_build_object('checklist',public.material_approved(auth.uid(),p_case,'checklist'),'draft',public.material_approved(auth.uid(),p_case,'draft'),'canApprove',public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'advogado_junior')); END; $$;
REVOKE ALL ON FUNCTION public.material_status(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.material_status(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.approve_material(p_case uuid,p_kind text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE work jsonb; BEGIN
 IF NOT (public.has_role(auth.uid(),'advogada_senior') OR public.has_role(auth.uid(),'advogado_junior')) THEN RAISE EXCEPTION 'Aprovação reservada ao advogado sênior ou júnior'; END IF;
 IF p_kind NOT IN ('checklist','draft') THEN RAISE EXCEPTION 'Tipo inválido'; END IF;
 PERFORM 1 FROM public.casos WHERE id=p_case AND owner_id=auth.uid() FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Caso indisponível'; END IF;
 SELECT dados->'casos'->p_case::text INTO work FROM public.office_workspace WHERE owner_id=auth.uid() FOR UPDATE;
 PERFORM 1 FROM public.checklist_itens WHERE caso_id=p_case AND owner_id=auth.uid() FOR UPDATE;
 IF p_kind='checklist' AND (NOT EXISTS(SELECT 1 FROM public.checklist_itens WHERE caso_id=p_case) OR EXISTS(SELECT 1 FROM public.checklist_itens WHERE caso_id=p_case AND NOT recebido)) THEN RAISE EXCEPTION 'Checklist incompleto'; END IF;
 IF p_kind='draft' AND (NOT public.material_approved(auth.uid(),p_case,'checklist') OR coalesce(trim(work->>'peticao'),'')='') THEN RAISE EXCEPTION 'A minuta exige checklist aprovado e texto salvo'; END IF;
 INSERT INTO public.legal_approvals(owner_id,caso_id,kind,revision,approved_by) VALUES(auth.uid(),p_case,p_kind,public.material_revision(auth.uid(),p_case,p_kind),auth.uid()); END; $$;
REVOKE ALL ON FUNCTION public.approve_material(uuid,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.approve_material(uuid,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.guard_legal_advance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid; phase text; stage integer; BEGIN
 IF TG_TABLE_NAME='casos' THEN
 stage=coalesce((NEW.dados->>'etapaPipeline')::integer,0);
 IF stage>coalesce((OLD.dados->>'etapaPipeline')::integer,0) THEN
 IF stage>=3 AND NOT public.material_approved(NEW.owner_id,NEW.id,'checklist') THEN RAISE EXCEPTION 'Avanço bloqueado: checklist sem aprovação jurídica'; END IF;
 IF stage>=4 AND NOT public.material_approved(NEW.owner_id,NEW.id,'draft') THEN RAISE EXCEPTION 'Avanço bloqueado: minuta sem aprovação jurídica'; END IF; END IF;
 ELSE
 FOR cid,phase IN SELECT key::uuid,value->>'fase' FROM jsonb_each(coalesce(NEW.dados->'casos','{}'::jsonb)) LOOP
 IF phase IN ('Em auditoria','Revisão concluída') AND phase IS DISTINCT FROM OLD.dados->'casos'->cid::text->>'fase' THEN
 IF NOT public.material_approved(NEW.owner_id,cid,'checklist') OR NOT public.material_approved(NEW.owner_id,cid,'draft') THEN RAISE EXCEPTION 'Avanço bloqueado: checklist e minuta exigem aprovação jurídica'; END IF;
 IF (NEW.dados->'casos'->cid::text - 'fase' - 'historico' - 'movements') IS DISTINCT FROM (OLD.dados->'casos'->cid::text - 'fase' - 'historico' - 'movements') THEN RAISE EXCEPTION 'Salve as alterações e obtenha nova aprovação antes de avançar'; END IF;
 END IF; END LOOP; END IF; RETURN NEW; END; $$;
CREATE TRIGGER guard_case_advance BEFORE UPDATE ON public.casos FOR EACH ROW EXECUTE FUNCTION public.guard_legal_advance();
CREATE TRIGGER guard_workspace_advance BEFORE UPDATE ON public.office_workspace FOR EACH ROW EXECUTE FUNCTION public.guard_legal_advance();