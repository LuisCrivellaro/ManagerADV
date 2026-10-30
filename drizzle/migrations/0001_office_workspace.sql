CREATE TABLE public.office_workspace (owner_id uuid PRIMARY KEY, dados jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE ON public.office_workspace TO authenticated;
GRANT ALL ON public.office_workspace TO service_role;
ALTER TABLE public.office_workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_read ON public.office_workspace FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY workspace_insert ON public.office_workspace FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY workspace_update ON public.office_workspace FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY case_documents_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY case_documents_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'case-documents' AND (storage.foldername(name))[1] = auth.uid()::text);