import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { officeDashboard } from "@/lib/office.functions";
import { buildAssessor } from "@/lib/assessor";
import { localDay } from "@/lib/dashboard";
import { setAuditUser } from "@/services/integracoes";
import { useOfficeNotifications } from "@/hooks/use-office-notifications";
import { LogOut, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import { QuickSearch } from '@/components/quick-search';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { redirect: location.href } });
    return { user: data.user };
  },
  component: Layout,
});

const roleLabel: Record<string, string> = {
  advogada_senior: "Advogada Sênior", advogado_junior: "Advogado Júnior", atendente: "Atendente/Assessora", operacoes: "Operações", admin: "Administrador",
};

function Layout() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  const { data: perfil } = useQuery({
    queryKey: ["perfil", user.id],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("nome").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      return { nome: p.data?.nome ?? user.email ?? "", roleIds: (r.data ?? []).map(x=>x.role), roles: (r.data ?? []).map((x) => roleLabel[x.role] ?? x.role) };
    },
  });

  const read=useServerFn(officeDashboard);
  const dashboard=useQuery({queryKey:["dashboard",user.id],queryFn:()=>read(),refetchInterval:15000});
  useOfficeNotifications(dashboard.data?.cases);
  const badges=buildAssessor(dashboard.data?.cases??[],localDay()).badges;
  useEffect(()=>{if(perfil)setAuditUser({id:user.id,nome:perfil.nome,perfil:perfil.roles.join(", ")});},[perfil,user.id]);
  const sair = async () => {
    setAuditUser({id:"",nome:"",perfil:""});
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", search: { redirect: undefined }, replace: true });
  };

  return (
    <SidebarProvider>
      <header className="fixed inset-x-0 top-0 z-30 office-header border-b-2 border-brand bg-card">
        <div className="flex h-full items-center gap-2 px-3 lg:gap-5 lg:px-5">
          <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
          <div className="min-w-0 shrink-0 md:pr-2"><p className="brand-lockup text-[15px] sm:text-xl">CS LAWYERS<span className="hidden md:inline"><span className="brand-bar">|</span>ADVOCACIA</span></p><p className="brand-cities mt-1.5 hidden md:block">Brasil • Dubai • Portugal</p></div>
          <QuickSearch />
          <div className="ml-auto flex min-w-0 items-center gap-1 text-sm md:gap-3">
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-auto min-w-0 gap-1 px-1 text-right"><span className="block max-w-20 leading-tight md:max-w-48"><span className="block truncate text-xs font-medium">{perfil?.nome}</span><span className="hidden truncate text-2xs text-muted-foreground sm:block">{roleLabel[['advogada_senior','advogado_junior','admin','atendente','operacoes'].find(r=>perfil?.roleIds.includes(r as typeof perfil.roleIds[number]))??'']}</span></span><ChevronDown className="size-3 shrink-0"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuLabel>Perfis de acesso</DropdownMenuLabel><DropdownMenuSeparator/>{perfil?.roles.map(r=><DropdownMenuLabel key={r} className="text-xs font-normal">{r}</DropdownMenuLabel>)}</DropdownMenuContent></DropdownMenu>
            <Button variant="ghost" size="sm" className="shrink-0 px-2" aria-label="Sair" onClick={sair}><LogOut /><span className="hidden md:inline">Sair</span></Button>
          </div>
        </div>
      </header>
      <div className="flex min-h-screen w-full office-content">
        <AppSidebar badges={badges} />
        <main className="min-w-0 flex-1"><Outlet /></main>
      </div>
    </SidebarProvider>
  );
}
