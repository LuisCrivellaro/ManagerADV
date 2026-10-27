CREATE TABLE public.legal_approvals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, caso_id uuid NOT NULL REFERENCES public.casos(id), kind text NOT NULL CHECK (kind IN ('audit','protocol')), revision text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.legal_approvals TO authenticated;
GRANT ALL ON public.legal_approvals TO service_role;
ALTER TABLE public.legal_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approval_read ON public.legal_approvals FOR SELECT TO authenticated USING (owner_id = auth.uid());