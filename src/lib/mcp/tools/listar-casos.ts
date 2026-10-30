import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_casos",
  title: "Listar casos",
  description:
    "Lista os casos do usuário conectado (nome, etapa e data de atualização), com busca opcional pelo nome.",
  inputSchema: {
    busca: z.string().max(100).optional().describe("Trecho do nome do cliente para filtrar."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca }, ctx) => {
    if (!ctx.isAuthenticated()) throw new ToolError("Não autenticado.");
    let q = supabaseForUser(ctx)
      .from("casos")
      .select("id, nome, etapa, updated_at")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (busca) q = q.ilike("nome", `%${busca}%`);
    const { data, error } = await q;
    if (error) throw new ToolError("Não foi possível ler os casos.");
    const casos = (data ?? []).map((c) => ({
      id: c.id,
      nome: c.nome,
      etapa: c.etapa,
      atualizado_em: c.updated_at,
    }));
    return {
      content: [
        {
          type: "text",
          text: casos.length
            ? casos.map((c) => `${c.id}: ${c.nome} — ${c.etapa}`).join("\n")
            : "Nenhum caso encontrado.",
        },
      ],
      structuredContent: { casos },
    };
  },
});
