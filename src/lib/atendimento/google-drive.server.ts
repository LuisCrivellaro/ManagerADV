/** Google Drive (conta do escritório) via gateway de conectores. Somente servidor. */
const GATEWAY = 'https://connector-gateway.lovable.dev/google_drive';
export const RAIZ_DRIVE = 'Manager ADV – CS Lawyers';

function headers(extra: Record<string, string> = {}) {
  const lovable = process.env['LOVABLE_API_KEY'];
  const drive = process.env['GOOGLE_DRIVE_API_KEY'];
  if (!lovable || !drive) throw new Error('Google Drive não conectado.');
  return { Authorization: `Bearer ${lovable}`, 'X-Connection-Api-Key': drive, ...extra };
}

async function ok<T>(r: Response, acao: string): Promise<T> {
  if (!r.ok) {
    const body = await r.text();
    console.error(`Drive ${acao} [${r.status}]: ${body}`);
    throw new Error(`Google Drive recusou ${acao} [${r.status}].`);
  }
  return r.json() as Promise<T>;
}

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function garantirPasta(nome: string, pai?: string): Promise<string> {
  const q = `name='${esc(nome)}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (pai ? ` and '${esc(pai)}' in parents` : '');
  const busca = await ok<{ files: { id: string }[] }>(
    await fetch(`${GATEWAY}/drive/v3/files?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '1' })}`, { headers: headers() }),
    'a busca de pasta',
  );
  if (busca.files[0]) return busca.files[0].id;
  const criada = await ok<{ id: string }>(
    await fetch(`${GATEWAY}/drive/v3/files?fields=id`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: nome, mimeType: 'application/vnd.google-apps.folder', ...(pai ? { parents: [pai] } : {}) }),
    }),
    'a criação de pasta',
  );
  return criada.id;
}

/** Garante a estrutura também em pastas antigas, sem mover ou alterar arquivos. */
export async function garantirSubpastasCliente(pastaCliente: string) {
  const nomes = ['1- Start', '2- Revisao', '3- Upload', '4- Andamento processual'] as const;
  const ids = await Promise.all(nomes.map(nome => garantirPasta(nome, pastaCliente)));
  const start = ids[0];
  if (!start) throw new Error('Pasta Start indisponível.');
  return { start };
}

/** Cria (ou reaproveita) Raiz / Categoria / Cliente e as quatro subpastas. */
export async function garantirPastaCliente(caminho: string) {
  let pai = await garantirPasta(RAIZ_DRIVE);
  for (const parte of caminho.split('/').filter(Boolean)) pai = await garantirPasta(parte.slice(0, 200), pai);
  await garantirSubpastasCliente(pai);
  return { id: pai, url: `https://drive.google.com/drive/folders/${pai}` };
}

/** Recebe o ID da pasta do cliente; todo original recebido entra em Start. */
export async function enviarArquivo(pasta: string, nome: string, mime: string, bytes: Uint8Array, documento?: { chave: string; tipo: string; descricao: string }) {
  const { start } = await garantirSubpastasCliente(pasta);
  if (documento) {
    const q = `'${esc(start)}' in parents and trashed=false and appProperties has { key='pdfOrigem' and value='${esc(documento.chave)}' }`;
    const existentes = await ok<{ files: { id: string; webViewLink?: string }[] }>(await fetch(`${GATEWAY}/drive/v3/files?${new URLSearchParams({ q, fields: 'files(id,webViewLink)', pageSize: '1' })}`, { headers: headers() }), 'a busca de PDF preparado');
    const existente = existentes.files[0];
    if (existente) return { id: existente.id, url: existente.webViewLink ?? `https://drive.google.com/file/d/${existente.id}/view` };
  }
  const limite = 'cslawyers' + crypto.randomUUID();
  const meta = JSON.stringify({ name: nome, parents: [start], ...(documento ? { description: `Tipo de Documento: ${documento.tipo}\nDescrição: ${documento.descricao}\nCópia de organização; exige revisão jurídica antes do protocolo.`, appProperties: { pdfOrigem: documento.chave } } : {}) });
  const enc = new TextEncoder();
  const partes = [enc.encode(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`), bytes, enc.encode(`\r\n--${limite}--`)];
  const corpo = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of partes) { corpo.set(p, o); o += p.length; }
  const r = await ok<{ id: string; webViewLink?: string }>(
    await fetch(`${GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST', headers: headers({ 'Content-Type': `multipart/related; boundary=${limite}` }), body: corpo,
    }),
    'o envio do arquivo',
  );
  return { id: r.id, url: r.webViewLink ?? `https://drive.google.com/file/d/${r.id}/view` };
}
