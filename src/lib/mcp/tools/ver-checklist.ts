import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "ver_checklist_caso",
  title: "Ver checklist do caso",
  description:
    "Mostra os itens do checklist de documentos de um caso do usuário conectado, indicando recebidos e pendentes.",
  inputSchema: {
    caso_id: z.string().uuid().describe("ID do caso, obtido em listar_casos."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ caso_id }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    const sb = supabaseForUser(ctx);
    const { data: caso } = await sb.from("casos").select("id, nome, etapa").eq("id", caso_id).maybeSingle();
    if (!caso) throw new ToolError("Caso não encontrado.");
    const { data, error } = await sb
      .from("checklist_itens")
      .select("nome, recebido, ordem")
      .eq("caso_id", caso_id)
      .order("ordem");
    if (error) throw new ToolError("Não foi possível ler o checklist.");
    const itens = (data ?? []).map((i) => ({ nome: i.nome, recebido: i.recebido }));
    return {
      content: [
        {
          type: "text",
          text:
            `${caso.nome} — ${caso.etapa}\n` +
            (itens.length
              ? itens.map((i) => `${i.recebido ? "[x]" : "[ ]"} ${i.nome}`).join("\n")
              : "Checklist vazio."),
        },
      ],
      structuredContent: { caso: { id: caso.id, nome: caso.nome, etapa: caso.etapa }, itens },
    };
  },
});
