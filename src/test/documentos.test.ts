import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import type { Conversa } from '@/lib/mock-data';
import { itemIdentificado, type ResultadoAnalise } from '@/lib/documentos-rules';
import { analisarAnexoDoCaso } from '@/lib/documentos.server';
import { PDFDocument } from 'pdf-lib';

const mocks = vi.hoisted(() => ({ analisar: vi.fn(), enviar: vi.fn() }));
vi.mock('@/lib/documentos.functions', () => ({ executarAnaliseDocumento: mocks.analisar }));
vi.mock('@/lib/atendimento/google-drive.server', () => ({ enviarArquivo: mocks.enviar }));
const resultado: ResultadoAnalise = { tipoDocumento: 'RG', itemChecklist: 'RG ou CNH', confianca: 'alta', nomeTitular: 'Pessoa Teste', cpf: null, datas: [], detalhesCaso: ['RG legível'], observacoes: null };

function fixture(aprovado = false, legado = false) {
  let caso = { mensagens: [{ id: 'entrada', path: 'owner/caso/original/rg.png', arquivo: 'rg.png', tipo: 'imagem', de: 'cliente', texto: '', hora: '10:00' }], timeline: legado ? [{ data: '2026-10-23', evento: 'Trato feito · pasta criada' }] : [] } as unknown as Conversa;
  const itens = legado ? [] : [{ id: 'item-rg', nome: 'RG ou CNH', recebido: false }];
  let writes = 0;
  const download = vi.fn(async () => ({ error: null, data: { type: 'image/png', size: 3, arrayBuffer: async () => new Uint8Array([1,2,3]).buffer } }));
  const db = { storage: { from: () => ({ download }) }, rpc: async () => ({ error: null, data: { checklist: aprovado } }), from(table: string) {
    let patch: any;
    const result = () => {
      if (table === 'casos') { if (patch) { caso = patch.dados; return { error: null, data: [{ id: 'caso' }] }; } return { error: null, data: { dados: caso, updated_at: 'revision' } }; }
      if (patch) { writes++; const first = itens[0]; if (first) first.recebido = patch.recebido; }
      return { error: null, data: itens };
    };
    const query: any = { select: () => query, eq: () => query, insert: (p: any[]) => { itens.push(...p.map((x, i) => ({ id: `item-${i}`, nome: x.nome, recebido: x.recebido }))); return query; }, update: (p: any) => { patch = p; return query; }, single: async () => result(), then: (resolve: any) => { const r = result(); return Promise.resolve({ ...r, data: Array.isArray(r.data) ? [...r.data] : r.data }).then(resolve); } };
    return query;
  } };
  return { db: db as unknown as SupabaseClient<Database>, get caso() { return caso; }, itens, download, get writes() { return writes; } };
}

describe('análise do original recebido', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.analisar.mockResolvedValue({ ok: true, resultado }); });
  it('marca RG ou CNH e guarda extração vinculada à mensagem', async () => {
    const f = fixture(); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(f.itens[0]?.recebido).toBe(true);
    expect(f.caso.mensagens[0]?.analiseDocumento?.nomeTitular).toBe('Pessoa Teste');
    expect(mocks.analisar).toHaveBeenCalledWith(expect.objectContaining({ mimeType: 'image/png', checklist: ['RG ou CNH'] }));
  });
  it('após identificar envia PDF específico a Start e persiste recibo sem substituir original ou reenviar', async () => {
    const f = fixture(); f.caso.pastaDrive = { id: 'cliente-drive', url: 'https://drive.google.com/drive/folders/cliente-drive' };
    const doc = await PDFDocument.create(); doc.addPage(); const bytes = await doc.save();
    f.download.mockResolvedValue({ error: null, data: { type: 'application/pdf', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer } });
    mocks.enviar.mockResolvedValue({ id: 'pdf-id', url: 'https://drive.google.com/file/d/pdf-id/view' });
    await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(mocks.enviar).toHaveBeenCalledWith('cliente-drive', expect.stringMatching(/^RG_[a-f0-9]{12}\.pdf$/), 'application/pdf', bytes, expect.objectContaining({ tipo: 'RG', descricao: 'RG' }));
    expect(f.caso.mensagens[0]?.pdfStart?.id).toBe('pdf-id');
    expect(f.caso.mensagens[0]?.path).toBe('owner/caso/original/rg.png');
    await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(mocks.enviar).toHaveBeenCalledOnce();
  });
  it('falha de conversão não desfaz extração ou recebimento e informa pendência', async () => {
    const f = fixture(); f.caso.pastaDrive = { id: 'cliente-drive', url: 'https://drive.google.com/drive/folders/cliente-drive' };
    await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(f.itens[0]?.recebido).toBe(true); expect(f.caso.mensagens[0]?.pendenciaPdf).toBeTruthy();
    expect(f.caso.mensagens[0]?.pdfStart).toBeUndefined(); expect(mocks.enviar).not.toHaveBeenCalled();
  });
  it('confiança média preserva checklist para revisão humana', async () => {
    mocks.analisar.mockResolvedValue({ ok: true, resultado: { ...resultado, confianca: 'media' } });
    const f = fixture(); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(f.writes).toBe(0); expect(f.caso.mensagens[0]?.confirmarTipo).toBe(true);
  });
  it('checklist aprovado exige confirmação explícita e não chama IA novamente', async () => {
    const f = fixture(true); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada'); expect(f.writes).toBe(0);
    await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada', true);
    expect(f.itens[0]?.recebido).toBe(true); expect(mocks.analisar).toHaveBeenCalledOnce();
  });
  it('mesmo anexo já analisado não repete análise nem marcação', async () => {
    const f = fixture(); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada'); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(mocks.analisar).toHaveBeenCalledOnce(); expect(f.writes).toBe(1); expect(f.caso.timeline).toHaveLength(1);
  });
  it('arquivo fora do proprietário não é baixado nem analisado', async () => {
    const f = fixture(); await expect(analisarAnexoDoCaso(f.db, 'caso', 'outro-owner', 'entrada')).rejects.toThrow('Original');
    expect(f.download).not.toHaveBeenCalled(); expect(mocks.analisar).not.toHaveBeenCalled();
  });
  it('nome desconhecido não vira item recebido', () => { expect(itemIdentificado({ ...resultado, itemChecklist: 'Documento inventado' }, [{ nome: 'RG ou CNH', recebido: false }])).toBeUndefined(); });
  it('comprovante de endereço reconhecido com ressalvas marca recebimento sem validar conteúdo', () => {
    const doc = { nome: 'Comprovante de endereço', recebido: false };
    expect(itemIdentificado({ ...resultado, tipoDocumento: 'Fatura de energia elétrica da Enel', itemChecklist: doc.nome, confianca: 'media' }, [doc])).toEqual(doc);
    expect(itemIdentificado({ ...resultado, tipoDocumento: 'Fatura de energia', itemChecklist: doc.nome, confianca: 'baixa' }, [doc])).toBeUndefined();
  });
  it('reanálise reaproveita extração e recupera item que ficou desmarcado', async () => {
    const f = fixture(); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    const item=f.itens[0]; if (!item) throw new Error('Item missing'); item.recebido=false;
    await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(item.recebido).toBe(true); expect(mocks.analisar).toHaveBeenCalledOnce();
  });
  it('recupera lista-base perdida no TRATO FEITO e marca somente RG ou CNH', async () => {
    const f = fixture(false, true); await analisarAnexoDoCaso(f.db, 'caso', 'owner', 'entrada');
    expect(f.itens.map(d => d.nome)).toEqual(['RG ou CNH', 'CPF', 'Comprovante de endereço', 'E-mail']);
    expect(f.itens.filter(d => d.recebido).map(d => d.nome)).toEqual(['RG ou CNH']);
  });
});