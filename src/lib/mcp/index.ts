import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listarCasos from "./tools/listar-casos";
import verChecklist from "./tools/ver-checklist";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "atendimento-legal-desk",
  title: "Atendimento Legal Desk",
  version: "0.1.0",
  instructions:
    "Ferramentas somente leitura do Manager ADV (CS Lawyers). Use listar_casos para encontrar casos do usuário e ver_checklist_caso para ver documentos recebidos e pendentes.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listarCasos, verChecklist],
});
