import { supabase } from "@/integrations/supabase/client";
import type { Conversa, DocItem } from "@/lib/mock-data";
import type { Json } from "@/integrations/supabase/types";

// Casos e checklist do usuário logado (RLS garante que cada um vê só os seus).
export async function listarCasos(): Promise<Conversa[]> {
  const [casos, itens] = await Promise.all([
    supabase.from("casos").select("id, dados, etapa, nome").order("ordem"),
    supabase.from("checklist_itens").select("id, caso_id, nome, recebido, ordem").order("ordem"),
  ]);
  if (casos.error) throw casos.error;
  if (itens.error) throw itens.error;
  return casos.data.map((c) => ({
    ...(c.dados as unknown as Omit<Conversa, "id" | "documentos" | "naoLidas">),
    id: c.id,
    nome: c.nome,
    etapa: c.etapa as Conversa["etapa"],
    naoLidas: 0,
    documentos: itens.data.filter((i) => i.caso_id === c.id).map<DocItem>((i) => ({ id: i.id, nome: i.nome, recebido: i.recebido })),
  }));
}

export async function salvarCaso(antes: Conversa, depois: Conversa) {
  const { id, documentos, naoLidas: _n, ...dados } = depois;
  const novos = documentos.filter(d => !d.id);
  if (novos.length) {
    const owner = await supabase.from('casos').select('owner_id').eq('id', id).single();
    if (owner.error) throw owner.error;
    const existentes = await supabase.from('checklist_itens').select('id,nome,recebido').eq('caso_id', id);
    if (existentes.error) throw existentes.error;
    const faltantes = novos.filter(d => !existentes.data.some(x => x.nome === d.nome));
    if (faltantes.length) {
      const insert = await supabase.from('checklist_itens').insert(faltantes.map((d, i) => ({ caso_id: id, owner_id: owner.data.owner_id, nome: d.nome, recebido: d.recebido, ordem: existentes.data.length + i }))).select('id,nome,recebido');
      if (insert.error) throw insert.error;
      existentes.data.push(...insert.data);
    }
    documentos.forEach(d => { if (!d.id) d.id = existentes.data.find(x => x.nome === d.nome)?.id; });
  }
  // Não sobrescrever mensagens/estado da Ana que chegaram depois da última leitura da equipe.
  let saved=false;
  for(let attempt=0;attempt<5;attempt++) {
    const row=await supabase.from('casos').select('dados,updated_at').eq('id',id).single();
    if(row.error)throw row.error;
    const current=row.data.dados as unknown as Conversa;
    const incoming=new Map((current.mensagens??[]).map(m=>[m.id,m]));
    const merged=depois.mensagens.map(m=>{const original=antes.mensagens.find(x=>x.id===m.id);const fresh=incoming.get(m.id);incoming.delete(m.id);return original&&fresh&&JSON.stringify(original)===JSON.stringify(m)?fresh:m;});
    const data={...dados,...(antes.email===depois.email?{email:current.email}:{}),mensagens:[...merged,...incoming.values()],agenteAna:{...(JSON.stringify(antes.agenteAna)===JSON.stringify(depois.agenteAna)?current.agenteAna:depois.agenteAna),pedidosProcesso:current.agenteAna?.pedidosProcesso,aguardandoAssuntoProcesso:current.agenteAna?.aguardandoAssuntoProcesso,consultaProcessoEmCurso:current.agenteAna?.consultaProcessoEmCurso,vinculoProjuris:current.agenteAna?.vinculoProjuris,aguardandoCpfProcesso:current.agenteAna?.aguardandoCpfProcesso,perguntaProcessoPendente:current.agenteAna?.perguntaProcessoPendente},...(antes.iaRetida===depois.iaRetida?{iaRetida:current.iaRetida}:{})};
    const r=await supabase.from('casos').update({dados:JSON.parse(JSON.stringify(data)) as Json,etapa:depois.etapa,nome:depois.nome,updated_at:new Date().toISOString()}).eq('id',id).eq('updated_at',row.data.updated_at).select('id');
    if(r.error)throw r.error;
    if(r.data?.length){saved=true;break;}
  }
  if(!saved)throw new Error('Conversa mudou durante o salvamento. Atualize e tente novamente.');
  const mudados = documentos.filter((d) => d.id && antes.documentos.find((a) => a.id === d.id)?.recebido !== d.recebido);
  for (const d of mudados) {
    if (!d.id) continue;
    const r = await supabase.from("checklist_itens").update({ recebido: d.recebido, updated_at: new Date().toISOString() }).eq("id", d.id);
    if (r.error) throw r.error;
  }
}
