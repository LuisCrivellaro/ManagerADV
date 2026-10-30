import { useRef, useState } from "react";
import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Sparkles, Upload, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analisarAnexoSalvo, type ResultadoAnalise } from "@/lib/documentos.functions";
import type { Conversa } from "@/lib/mock-data";
import { supabase } from "@/integrations/supabase/client";
import { newMessage } from "@/lib/atendimento";
import { saveFile } from "@/lib/office-store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Analise = { arquivo: string; resultado: ResultadoAnalise };

export function AnaliseDocumento({ c, update }: { c: Conversa; update: (fn: (c: Conversa) => Conversa) => Promise<unknown> }) {
  const input = useRef<HTMLInputElement>(null);
  const analisar = useServerFn(analisarAnexoSalvo);
  const qc = useQueryClient();
  const [carregando, setCarregando] = useState<string | null>(null);
  const analises: Analise[] = c.mensagens.flatMap(m => m.analiseDocumento ? [{ arquivo: m.arquivo ?? 'Documento', resultado: m.analiseDocumento }] : []).reverse();
  const refresh = () => Promise.all(['casos','office','material-approvals','clients-directory','dashboard'].map(key => qc.invalidateQueries({ queryKey: [key] })));
  const [pendingMessage, setPendingMessage] = useState<string>();
  const reanalisar = async (id: string, confirmarAlteracao = false) => {
    setCarregando('documento recebido');
    try {
      const r = await analisar({ data: { casoId: c.id, mensagemId: id, confirmarAlteracao } });
      await refresh();
      if (!r.ok) { toast.error(r.erro); return; }
      if (r.pendenciaPdf) toast.warning(r.pendenciaPdf);
      if (r.pendencia) toast.warning(r.pendencia);
      else toast.success(r.checklistAtualizado ? 'Documento identificado e checklist atualizado.' : 'Análise guardada; confira a correspondência com o checklist.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível analisar.'); }
    finally { setCarregando(null); }
  };

  const [pendingFile,setPendingFile]=useState<File>();
  const checkApproval=async(f:File)=>{const status=await supabase.rpc("material_status",{p_case:c.id});if(status.error){toast.error("Não foi possível verificar a aprovação.");return;}if((status.data as {checklist?:boolean}|null)?.checklist)setPendingFile(f);else await processar(f);};
  const processar = async (f: File, confirmarAlteracao = false) => {
    if (f.size > 10 * 1024 * 1024) { toast.error("Arquivo muito grande (máx. 10 MB)"); return; }
    setCarregando(f.name);
    try {
      const {data:userData}=await supabase.auth.getUser();if(!userData.user)throw new Error("Entre novamente para guardar o documento.");
      const saved=await saveFile(userData.user.id,c.id,f);
      const message = newMessage('', { de: 'cliente', tipo: f.type.startsWith('image/') ? 'imagem' : 'documento', arquivo: f.name, path: saved.path, salvoStart: true });
      await update(x => ({ ...x, mensagens: [...x.mensagens, message] }));
      await reanalisar(message.id, confirmarAlteracao);
    } catch (e) {
      toast.error((e as Error).message || "Falha ao enviar o arquivo");
    } finally {
      setCarregando(null);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t pt-3">
      <h3 className="section-title text-sm">Análise de documentos com IA</h3>
      <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void checkApproval(f); }} />
      <Button variant="outline" className="w-full" disabled={!!carregando} onClick={() => input.current?.click()}>
        {carregando ? <><Loader2 className="animate-spin" />Analisando {carregando}…</> : <><Upload />Enviar documento do cliente</>}
      </Button>
      <p className="text-xs text-muted-foreground">PDF ou imagem. A IA identifica o tipo, extrai dados do caso e marca o item do checklist.</p>
      {c.mensagens.filter(m => m.path && (m.tipo === 'imagem' || m.tipo === 'documento') && (!m.analiseDocumento || m.pendenciaChecklist || m.pendenciaPdf)).map(m => <div key={m.id} className="space-y-1 border-b py-2 text-xs"><p className="truncate">{m.arquivo}</p>{(m.erroAnalise || m.pendenciaChecklist || m.pendenciaPdf) && <p className="text-pending-foreground">{m.erroAnalise || m.pendenciaChecklist || m.pendenciaPdf}</p>}<Button size="sm" variant="outline" disabled={!!carregando} onClick={() => m.pendenciaChecklist ? setPendingMessage(m.id) : void reanalisar(m.id)}><Sparkles/>{m.pendenciaChecklist ? 'Confirmar atualização do checklist' : m.pendenciaPdf ? 'Preparar PDF em Start' : 'Analisar original recebido'}</Button></div>)}
      {analises.map((a, i) => (
        <div key={i} className="rounded-lg border-l-4 border-primary bg-secondary p-2.5 text-sm">
          <p className="flex items-center gap-1 font-semibold"><Sparkles className="size-3.5 text-primary" />{a.resultado.tipoDocumento}</p>
          <p className="truncate text-xs text-muted-foreground">{a.arquivo}</p>
          <div className="mt-1 flex flex-wrap gap-1 text-2xs">
            <span className={cn("rounded px-1.5 py-0.5", a.resultado.itemChecklist ? "bg-success text-success-foreground" : "bg-pending text-pending-foreground")}>
              {a.resultado.itemChecklist ? <><CheckCircle2 className="mr-0.5 inline size-3" />Correspondência: {a.resultado.itemChecklist}</> : "Fora do checklist"}
            </span>
            <span className={cn("rounded px-1.5 py-0.5", a.resultado.confianca === "baixa" ? "bg-pending text-pending-foreground" : "bg-card")}>confiança {a.resultado.confianca}</span>
          </div>
          {(a.resultado.nomeTitular || a.resultado.cpf) && <p className="mt-1 text-xs">{a.resultado.nomeTitular}{a.resultado.cpf && ` · CPF ${a.resultado.cpf}`}</p>}
          {a.resultado.datas.length > 0 && <ul className="mt-1 text-xs">{a.resultado.datas.map((d, j) => <li key={j}><b>{d.descricao}:</b> {d.data}</li>)}</ul>}
          {a.resultado.detalhesCaso.length > 0 && <ul className="mt-1 list-disc pl-4 text-xs">{a.resultado.detalhesCaso.map((d, j) => <li key={j}>{d}</li>)}</ul>}
          {a.resultado.observacoes && <p className="mt-1 rounded bg-pending px-1.5 py-0.5 text-xs text-pending-foreground">{a.resultado.observacoes}</p>}
        </div>
      ))}
      <Dialog open={!!pendingFile || !!pendingMessage} onOpenChange={v=>{if(!v){setPendingFile(undefined);setPendingMessage(undefined);}}}><DialogContent><DialogHeader><DialogTitle>Confirmar alteração do checklist</DialogTitle></DialogHeader><p>A alteração pode invalidar a aprovação jurídica. Será necessária nova aprovação para avançar.</p><DialogFooter><Button variant="outline" onClick={()=>{setPendingFile(undefined);setPendingMessage(undefined);}}>Cancelar</Button><Button onClick={()=>{const f=pendingFile;const id=pendingMessage;setPendingFile(undefined);setPendingMessage(undefined);if(f)void processar(f,true);else if(id)void reanalisar(id,true);}}>Confirmar análise</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
