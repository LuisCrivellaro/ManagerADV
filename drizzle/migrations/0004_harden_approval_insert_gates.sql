CREATE OR REPLACE FUNCTION public.guard_legal_advance() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE cid uuid; phase text; stage integer; previous integer; prior_phase text; BEGIN
 IF TG_TABLE_NAME='casos' THEN
 stage=coalesce((NEW.dados->>'etapaPipeline')::integer,0); IF stage<0 OR stage>9 THEN RAISE EXCEPTION 'Etapa inválida'; END IF;
 previous=CASE WHEN TG_OP='INSERT' THEN 0 ELSE coalesce((OLD.dados->>'etapaPipeline')::integer,0) END;
 IF stage>previous THEN
 IF stage>=3 AND NOT public.material_approved(NEW.owner_id,NEW.id,'checklist') THEN RAISE EXCEPTION 'Avanço bloqueado: checklist sem aprovação jurídica'; END IF;
 IF stage>=4 THEN
 IF NOT public.material_approved(NEW.owner_id,NEW.id,'draft') THEN RAISE EXCEPTION 'Avanço bloqueado: minuta sem aprovação jurídica'; END IF;
 IF TG_OP='UPDATE' AND (NEW.dados - 'etapaPipeline' - 'syncs' - 'timeline' - 'mensagens') IS DISTINCT FROM (OLD.dados - 'etapaPipeline' - 'syncs' - 'timeline' - 'mensagens') THEN RAISE EXCEPTION 'Salve as alterações e obtenha nova aprovação antes de avançar'; END IF;
 END IF; END IF;
 ELSE
 FOR cid,phase IN SELECT key::uuid,value->>'fase' FROM jsonb_each(coalesce(NEW.dados->'casos','{}'::jsonb)) LOOP
 prior_phase=CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.dados->'casos'->cid::text->>'fase' END;
 IF phase IN ('Em auditoria','Revisão concluída') AND phase IS DISTINCT FROM prior_phase THEN
 IF NOT public.material_approved(NEW.owner_id,cid,'checklist') OR NOT public.material_approved(NEW.owner_id,cid,'draft') THEN RAISE EXCEPTION 'Avanço bloqueado: checklist e minuta exigem aprovação jurídica'; END IF;
 IF TG_OP='INSERT' OR (NEW.dados->'casos'->cid::text - 'fase' - 'historico' - 'movements') IS DISTINCT FROM (OLD.dados->'casos'->cid::text - 'fase' - 'historico' - 'movements') THEN RAISE EXCEPTION 'Salve as alterações e obtenha nova aprovação antes de avançar'; END IF;
 END IF; END LOOP; END IF; RETURN NEW; END; $$;
CREATE TRIGGER guard_case_insert BEFORE INSERT ON public.casos FOR EACH ROW WHEN (coalesce((NEW.dados->>'etapaPipeline')::integer,0)>0 AND current_user='authenticated') EXECUTE FUNCTION public.guard_legal_advance();
CREATE TRIGGER guard_workspace_insert BEFORE INSERT ON public.office_workspace FOR EACH ROW EXECUTE FUNCTION public.guard_legal_advance();