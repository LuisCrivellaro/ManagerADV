import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s["authorization_id"] === "string" ? s["authorization_id"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Autorizar conexão — Manager ADV" },
      { name: "description", content: "Autorize um assistente a acessar o Manager ADV em seu nome." },
      { property: "og:title", content: "Autorizar conexão — Manager ADV" },
      { property: "og:description", content: "Autorize um assistente a acessar o Manager ADV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Pedido de autorização inválido ou ausente.");
    const { data } = await supabase.auth.getSession();
    if (!data.session)
      throw redirect({ to: "/auth", search: { redirect: location.pathname + location.searchStr } });
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(id);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    const { data: u } = await supabase.auth.getUser();
    return { details: data, email: u.user?.email ?? "" };
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md p-8 text-sm">
      <h1 className="mb-2 text-lg font-semibold">Não foi possível carregar a autorização</h1>
      <p className="text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p>
    </main>
  ),
});

function Consent() {
  const { details, email } = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cliente = details?.client?.name ?? "Um aplicativo";
  const escopos: string[] = String(details?.scope ?? "").split(/\s+/).filter(Boolean);
  const rotulo = (s: string) =>
    s === "openid" ? "Identificar sua conta" : s === "email" ? "Compartilhar seu e-mail" : s === "profile" ? "Compartilhar seu perfil básico" : `Permissão adicional: ${s}`;

  async function decidir(aprovar: boolean) {
    setBusy(true);
    setErro(null);
    const { data, error } = aprovar
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setErro(error.message); return; }
    const alvo = data?.redirect_url ?? data?.redirect_to;
    if (!alvo) { setBusy(false); setErro("O servidor de autorização não retornou endereço de retorno."); return; }
    window.location.href = alvo;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-4 rounded-lg border bg-card p-6">
        <h1 className="text-xl font-semibold">Conectar {cliente} ao Manager ADV</h1>
        <p className="text-sm text-muted-foreground">
          Conta: <b>{email}</b>. {cliente} poderá consultar seus casos e checklists como você, somente leitura.
        </p>
        {details?.redirect_uri && (
          <p className="break-all text-xs text-muted-foreground">Retorno: {details.redirect_uri}</p>
        )}
        {escopos.length > 0 && (
          <ul className="list-disc pl-5 text-sm">{escopos.map((s) => <li key={s}>{rotulo(s)}</li>)}</ul>
        )}
        <p className="text-xs text-muted-foreground">
          Isso não ignora as permissões do escritório nem as regras de acesso aos dados.
        </p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <div className="flex gap-2">
          <Button disabled={busy} onClick={() => decidir(true)}>Autorizar</Button>
          <Button variant="outline" disabled={busy} onClick={() => decidir(false)}>Cancelar conexão</Button>
        </div>
      </div>
    </main>
  );
}
