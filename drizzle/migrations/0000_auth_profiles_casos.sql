CREATE TYPE public.app_role AS ENUM ('advogada_senior','advogado_junior','atendente','operacoes','admin');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  cargo text NOT NULL DEFAULT 'Atendente/Assessora',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE TABLE public.casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  nome text NOT NULL,
  etapa text NOT NULL DEFAULT 'inicial',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.casos(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.casos TO authenticated;
GRANT ALL ON public.casos TO service_role;
ALTER TABLE public.casos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own casos select" ON public.casos FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own casos insert" ON public.casos FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own casos update" ON public.casos FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own casos delete" ON public.casos FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.checklist_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id uuid NOT NULL REFERENCES public.casos(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  nome text NOT NULL,
  recebido boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.checklist_itens(caso_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_itens TO authenticated;
GRANT ALL ON public.checklist_itens TO service_role;
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own itens select" ON public.checklist_itens FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "own itens insert" ON public.checklist_itens FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.casos c WHERE c.id = caso_id AND c.owner_id = auth.uid()));
CREATE POLICY "own itens update" ON public.checklist_itens FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "own itens delete" ON public.checklist_itens FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TABLE public.casos_modelo (ordem int PRIMARY KEY, dados jsonb NOT NULL);
GRANT ALL ON public.casos_modelo TO service_role;
ALTER TABLE public.casos_modelo ENABLE ROW LEVEL SECURITY;
INSERT INTO public.casos_modelo (ordem, dados) VALUES
(0, $j${"nome":"Mariana Albuquerque Teixeira","cpf":"412.887.330-15","telefone":"(11) 98812-4471","atendimento":"AT-2026-0418","etapa":"documentos","etapaPipeline":2,"syncs":["sincronizado","sincronizado","pendente"],"contrato":"assinado","processos":[],"documentos":[{"nome":"RG ou CNH","recebido":true},{"nome":"CPF","recebido":true},{"nome":"Comprovante de residência","recebido":true},{"nome":"Carteira de trabalho (CTPS)","recebido":false},{"nome":"Extrato CNIS","recebido":true},{"nome":"Laudos médicos","recebido":false}],"consulta":{"duracao":"38:12","resumo":"Cliente trabalhou 9 anos como auxiliar de produção, afastada por LER/DORT desde 03/2025. Benefício por incapacidade negado pelo INSS em 08/2026. Tese: restabelecimento de auxílio por incapacidade temporária com conversão em aposentadoria por incapacidade permanente.","transcricao":"Dra. Carolina: Boa tarde, Mariana. Pode me contar desde quando sente as dores?\nMariana: Desde o começo de 2025, doutora. Primeiro no punho, depois no ombro…"},"timeline":[{"data":"02/10/2026","evento":"Primeiro contato via WhatsApp"},{"data":"06/10/2026","evento":"Consulta inicial realizada (gravada)"},{"data":"08/10/2026","evento":"Contrato assinado via ZapSign"},{"data":"09/10/2026","evento":"Pasta criada no Google Drive"}],"mensagens":[{"id":"m1","de":"escritorio","texto":"Olá, Mariana! Aqui é a assessora da Dra. Carolina Santos. Para darmos andamento ao seu caso, precisamos dos documentos da lista abaixo.","hora":"09:12"},{"id":"m2","de":"cliente","texto":"Bom dia! Vou mandar agora o que eu tenho aqui","hora":"10:03"},{"id":"m3","de":"cliente","texto":"","tipo":"documento","arquivo":"RG_Mariana.pdf","salvoStart":true,"hora":"10:04"},{"id":"m4","de":"cliente","texto":"","tipo":"documento","arquivo":"comprovante_residencia.jpg","salvoStart":true,"hora":"10:05"},{"id":"m5","de":"cliente","texto":"A carteira de trabalho tá com meu marido, mando amanhã. Os laudos preciso pegar no posto, pode ser?","hora":"10:07"}]}$j$::jsonb),
(1, $j${"nome":"Rogério Batista Nunes","cpf":"305.119.428-60","telefone":"(21) 99731-0582","atendimento":"AT-2026-0425","etapa":"inicial","etapaPipeline":0,"syncs":[],"processos":[],"documentos":[{"nome":"RG ou CNH","recebido":false},{"nome":"CPF","recebido":false},{"nome":"Comprovante de residência","recebido":false},{"nome":"Carteira de trabalho (CTPS)","recebido":false},{"nome":"Extrato CNIS","recebido":false},{"nome":"Laudos médicos","recebido":false}],"timeline":[{"data":"19/10/2026","evento":"Primeiro contato via WhatsApp"}],"mensagens":[{"id":"m1","de":"cliente","texto":"Boa tarde. Fui demitido semana passada e não pagaram minha rescisão. A doutora atende trabalhista?","hora":"16:41"}]}$j$::jsonb),
(2, $j${"nome":"Helena Cardoso Prado","cpf":"198.204.557-02","telefone":"(31) 98455-2290","atendimento":"AT-2026-0377","etapa":"ativo","etapaPipeline":9,"syncs":["sincronizado","sincronizado","sincronizado","sincronizado","sincronizado","sincronizado","sincronizado","sincronizado","sincronizado"],"contrato":"assinado","processos":[{"cnj":"5004821-37.2026.4.03.6183","vara":"3ª Vara Previdenciária de São Paulo","status":"Aguardando perícia médica marcada pelo juiz","homologado":false},{"cnj":"1012334-08.2025.8.26.0100","vara":"12ª Vara Cível do Foro Central","status":"Acordo aprovado pelo juiz, aguardando pagamento","homologado":true}],"documentos":[{"nome":"RG ou CNH","recebido":true},{"nome":"CPF","recebido":true},{"nome":"Comprovante de residência","recebido":true},{"nome":"Carteira de trabalho (CTPS)","recebido":true},{"nome":"Extrato CNIS","recebido":true},{"nome":"Laudos médicos","recebido":true}],"timeline":[{"data":"14/07/2026","evento":"Contrato assinado"},{"data":"02/09/2026","evento":"Petição protocolada"},{"data":"15/10/2026","evento":"Perícia designada para 11/11/2026"}],"mensagens":[{"id":"m1","de":"escritorio","texto":"Helena, sua perícia foi marcada para 11/11/2026 às 14h30, no Fórum Previdenciário (Av. Paulista, 1682). Leve documento com foto e todos os laudos.","hora":"Ontem"},{"id":"m2","de":"cliente","texto":"Obrigada! Posso levar acompanhante?","hora":"Ontem"},{"id":"m3","de":"escritorio","texto":"Pode sim. 🙂","hora":"Ontem"}]}$j$::jsonb),
(3, $j${"nome":"Paulo Henrique Siqueira","cpf":"667.903.214-88","telefone":"(41) 99120-7735","atendimento":"AT-2026-0421","etapa":"inicial","etapaPipeline":0,"syncs":[],"processos":[],"documentos":[{"nome":"RG ou CNH","recebido":false},{"nome":"CPF","recebido":false},{"nome":"Comprovante de residência","recebido":false},{"nome":"Carteira de trabalho (CTPS)","recebido":false},{"nome":"Extrato CNIS","recebido":false},{"nome":"Laudos médicos","recebido":false}],"contrato":"enviado","timeline":[{"data":"15/10/2026","evento":"Primeiro contato"},{"data":"17/10/2026","evento":"Consulta inicial"},{"data":"18/10/2026","evento":"Contrato enviado para assinatura"}],"consulta":{"duracao":"24:50","resumo":"Revisão de aposentadoria — período rural de 1988 a 1996 não reconhecido.","transcricao":"Paulo: Trabalhei na roça com meu pai até 96…"},"mensagens":[{"id":"m1","de":"escritorio","texto":"Paulo, enviamos o contrato para assinatura digital. É só abrir o link e seguir as instruções.","hora":"18/10"},{"id":"m2","de":"cliente","texto":"","tipo":"audio","arquivo":"Áudio 0:42","hora":"18/10"}]}$j$::jsonb),
(4, $j${"nome":"Juliana Moreira Lacerda","cpf":"520.348.771-93","telefone":"(11) 97644-1308","atendimento":"AT-2026-0402","etapa":"documentos","etapaPipeline":2,"syncs":["sincronizado","erro"],"contrato":"assinado","processos":[],"documentos":[{"nome":"RG ou CNH","recebido":true},{"nome":"CPF","recebido":true},{"nome":"Comprovante de residência","recebido":false},{"nome":"Carteira de trabalho (CTPS)","recebido":false},{"nome":"Extrato CNIS","recebido":false},{"nome":"Laudos médicos","recebido":true}],"timeline":[{"data":"28/09/2026","evento":"Contrato assinado"}],"mensagens":[{"id":"m1","de":"cliente","texto":"","tipo":"imagem","arquivo":"laudo_ortopedista.jpg","salvoStart":true,"hora":"Sex"}]}$j$::jsonb);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record; novo uuid; d jsonb; i int;
BEGIN
  INSERT INTO public.profiles (id, nome) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'atendente');
  FOR m IN SELECT * FROM public.casos_modelo ORDER BY ordem LOOP
    INSERT INTO public.casos (owner_id, nome, etapa, dados, ordem)
      VALUES (NEW.id, m.dados->>'nome', m.dados->>'etapa', m.dados - 'documentos', m.ordem) RETURNING id INTO novo;
    i := 0;
    FOR d IN SELECT * FROM jsonb_array_elements(m.dados->'documentos') LOOP
      INSERT INTO public.checklist_itens (caso_id, owner_id, nome, recebido, ordem) VALUES (novo, NEW.id, d->>'nome', (d->>'recebido')::boolean, i);
      i := i + 1;
    END LOOP;
  END LOOP;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();