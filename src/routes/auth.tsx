import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import "@lovable.dev/cloud-auth-js/styles.css";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { oauthReturnPath } from "@/lib/oauth-return-path";

const destinoSeguro = (r?: string) => oauthReturnPath(r);
const urlRetorno = (r?: string) => new URL(destinoSeguro(r), window.location.origin).href;

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s["redirect"] === "string" ? s["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Manager ADV" },
      { name: "description", content: "Acesso da equipe CS Lawyers ao Manager ADV." },
      { property: "og:title", content: "Entrar — Manager ADV" },
      { property: "og:description", content: "Acesso da equipe CS Lawyers ao Manager ADV." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const router = useRouter();
  const ir = () => router.history.replace(destinoSeguro(redirect));
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) ir();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e) => {
      if (e === "SIGNED_IN") ir();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, redirect]); // eslint-disable-line react-hooks/exhaustive-deps

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: urlRetorno(redirect), data: { full_name: nome } },
        });
        if (error) throw error;
        if (!data.session) setConfirmar(true);
      }
    } catch (err) {
      const m = (err as Error).message;
      toast.error(m.includes("Invalid login") ? "E-mail ou senha incorretos." : m);
    } finally {
      setCarregando(false);
    }
  };

  const social = async (p: "google" | "lovable") => {
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: urlRetorno(redirect) });
    if (r.error) toast.error("Não foi possível entrar. Tente novamente.");
  };

  return (
    <div className="grid min-h-screen grid-rows-[auto_1fr] bg-card lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:grid-rows-1">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-petrol px-6 py-8 text-[#D3E6E4] sm:px-10 lg:px-14 lg:py-14">
        <div>
          <p className="brand-lockup text-xl !text-white sm:text-2xl">
            CS LAWYERS<span className="brand-bar">|</span>ADVOCACIA
          </p>
          <p className="brand-cities mt-2 !text-brand">Brasil • Dubai • Portugal</p>
        </div>
        <div className="mt-10 hidden max-w-md lg:block">
          <div className="mb-6 h-0.5 w-14 bg-brand" />
          <p className="font-serif text-[2.75rem] font-medium leading-[1.05] text-white">
            Manager ADV
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-[#A9C9C6]">
            Do primeiro contato do cliente ao andamento do processo, com revisão da advogada em cada
            etapa.
          </p>
        </div>
        <p className="mt-10 hidden text-xs text-[#7FA6A2] lg:block">
          Uso interno da equipe do escritório.
        </p>
      </aside>
      <main className="flex items-start justify-center px-5 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-sm">
          <h1 className="mb-1 text-[1.75rem] font-semibold leading-tight">
            {modo === "entrar" ? "Entrar no Manager ADV" : "Criar conta da equipe"}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {modo === "entrar"
              ? "Use o e-mail cadastrado pelo escritório."
              : "Contas novas entram como atendente; o escritório ajusta o perfil de acesso."}
          </p>
          {confirmar ? (
            <p className="rounded bg-secondary p-3 text-sm">
              Enviamos um link de confirmação para <b>{email}</b>. Abra o e-mail para ativar sua
              conta.
            </p>
          ) : (
            <>
              <form onSubmit={enviar} className="space-y-3">
                {modo === "cadastrar" && (
                  <div>
                    <Label htmlFor="nome">Nome</Label>
                    <Input
                      id="nome"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                    />
                  </div>
                )}
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="senha">Senha</Label>
                  <Input
                    id="senha"
                    type="password"
                    required
                    minLength={6}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={carregando}>
                  {carregando && <Loader2 className="animate-spin" />}
                  {modo === "entrar" ? "Entrar" : "Criar conta"}
                </Button>
              </form>
              <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                ou
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" onClick={() => social("google")}>
                  Continuar com Google
                </Button>
                <button
                  type="button"
                  className="lovable-auth-button w-full"
                  onClick={() => social("lovable")}
                >
                  Continue with Lovable
                </button>
              </div>
              <button
                className="mt-4 w-full text-center text-sm text-primary hover:underline"
                onClick={() => setModo(modo === "entrar" ? "cadastrar" : "entrar")}
              >
                {modo === "entrar" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
