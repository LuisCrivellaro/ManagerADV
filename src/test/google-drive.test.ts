import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enviarArquivo, garantirPastaCliente } from '@/lib/atendimento/google-drive.server';

describe('pastas e originais do Google Drive', () => {
  const folders = new Map<string, string>();
  const created: { name: string; parents?: string[] }[] = [];
  let uploaded = '';

  beforeEach(() => {
    folders.clear(); created.length = 0; uploaded = '';
    vi.stubEnv('LOVABLE_API_KEY', 'test');
    vi.stubEnv('GOOGLE_DRIVE_API_KEY', 'test');
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      if (url.pathname.includes('/upload/')) {
        uploaded = new TextDecoder().decode(init?.body as Uint8Array);
        return Response.json({ id: 'original-id' });
      }
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body));
        created.push(body);
        const id = `folder-${created.length}`;
        folders.set(`${body.parents?.[0] ?? ''}/${body.name}`, id);
        return Response.json({ id });
      }
      const q = url.searchParams.get('q') ?? '';
      const name = q.match(/^name='([^']+)'/)?.[1];
      const parent = q.match(/and '([^']+)' in parents/)?.[1] ?? '';
      const id = folders.get(`${parent}/${name}`);
      return Response.json({ files: id ? [{ id }] : [] });
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('cria as quatro subpastas dentro do cliente e reaproveita sem duplicar', async () => {
    const cliente = await garantirPastaCliente('RT/Cliente');
    expect(created.filter(x => x.parents?.[0] === cliente.id).map(x => x.name)).toEqual([
      '1- Start', '2- Revisao', '3- Upload', '4- Andamento processual',
    ]);
    expect(await garantirPastaCliente('RT/Cliente')).toEqual(cliente);
    expect(created).toHaveLength(7);
  });

  it('envia o documento inicialmente para Start, não para a raiz nem Upload', async () => {
    folders.set('cliente-antigo/1- Start', 'start-existente');
    const original = new Uint8Array([65, 66, 67]);
    await enviarArquivo('cliente-antigo', 'rg.png', 'image/png', original);
    expect(uploaded).toContain('"parents":["start-existente"]');
    expect(uploaded).not.toContain('"parents":["cliente-antigo"]');
    expect(uploaded).toContain('ABC');
    expect(Array.from(original)).toEqual([65, 66, 67]);
    expect(created.map(x => x.name)).toEqual(['2- Revisao', '3- Upload', '4- Andamento processual']);
  });

  it('não envia o original à raiz se não conseguir garantir Start', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'indisponível' }, { status: 503 })));
    await expect(enviarArquivo('cliente', 'rg.png', 'image/png', new Uint8Array([1]))).rejects.toThrow();
    expect(uploaded).toBe('');
  });
  it('envia PDF identificado a Start com tipo e descrição específicos e chave de origem', async () => {
    folders.set('cliente/1- Start', 'start-id');
    await enviarArquivo('cliente', 'Comprovante_Residencia_abcdef123456.pdf', 'application/pdf', new Uint8Array([65]), { chave: 'hash:pdf', tipo: 'Comprovante de Residência', descricao: 'Comprovante de Residência' });
    expect(uploaded).toContain('"parents":["start-id"]');
    expect(uploaded).toContain('Tipo de Documento: Comprovante de Residência');
    expect(uploaded).toContain('Descrição: Comprovante de Residência');
    expect(uploaded).toContain('"pdfOrigem":"hash:pdf"');
    expect(uploaded).toContain('Content-Type: application/pdf');
  });
  it('reaproveita o recibo da mesma origem sem reenviar o PDF', async () => {
    const originalFetch = fetch;
    vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
      if (new URL(input).searchParams.get('q')?.includes("key='pdfOrigem'")) return Response.json({ files: [{ id: 'pdf-existente' }] });
      return originalFetch(input, init);
    }));
    const receipt = await enviarArquivo('cliente', 'RG_abcdef123456.pdf', 'application/pdf', new Uint8Array([65]), { chave: 'hash:pdf', tipo: 'RG', descricao: 'RG' });
    expect(receipt.id).toBe('pdf-existente'); expect(uploaded).toBe('');
  });
});