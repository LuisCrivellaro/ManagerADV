// Backend falso, em memória, SÓ para a versão de demonstração no navegador.
// Substitui o Supabase: login, tabelas, funções (rpc) e arquivos. Dados fictícios.
import seed from './seed.json';

export const USER = '11111111-1111-4111-8111-111111111111';
const LAWYER2 = '22222222-2222-4222-8222-222222222222';
const caseId = (i: number) => `aaaaaaaa-0000-4000-8000-00000000000${i}`;
const KEY = 'manager-adv-demo-db-v2';
const SESSION_KEY = 'manager-adv-demo-session-v1';
type Row = Record<string, any>;

const store = {
  get(k: string) { try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; } },
  set(k: string, v: string) { try { globalThis.localStorage?.setItem(k, v); } catch { /* sem armazenamento */ } },
  del(k: string) { try { globalThis.localStorage?.removeItem(k); } catch { /* sem armazenamento */ } },
};

function seedDb(): Record<string, Row[]> {
  const now = new Date().toISOString();
  const db: Record<string, Row[]> = {
    profiles: [
      { id: USER, nome: 'Dra. Carolina Santos', cargo: 'Advogada Sênior' },
      { id: LAWYER2, nome: 'Dr. Rafael Costa', cargo: 'Advogado Júnior' },
    ],
    user_roles: [
      { user_id: USER, role: 'advogada_senior' },
      { user_id: USER, role: 'admin' },
      { user_id: LAWYER2, role: 'advogado_junior' },
    ],
    casos: [], checklist_itens: [], office_workspace: [], legal_approvals: [], draft_review_assignments: [], files: [],
  };
  (seed as any[]).forEach((d, i) => {
    const { documentos, ...dados } = d;
    db.casos.push({ id: caseId(i), owner_id: USER, nome: d.nome, etapa: d.etapa, dados, ordem: i, updated_at: now });
    (documentos as any[]).forEach((doc, j) =>
      db.checklist_itens.push({ id: `bbbbbbbb-0000-4000-8000-0000000${i}0${j}`, caso_id: caseId(i), owner_id: USER, nome: doc.nome, recebido: doc.recebido, ordem: j }),
    );
  });
  const day = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  db.office_workspace.push({
    owner_id: USER, updated_at: now,
    dados: {
      demo: true,
      casos: {
        [caseId(0)]: { area: 'Previdenciário', fase: 'Em redação', pendencias: ['Solicitar laudo atualizado do ortopedista'], peticao: 'EXCELENTÍSSIMO SENHOR DOUTOR JUIZ FEDERAL DA ___ VARA PREVIDENCIÁRIA DE SÃO PAULO/SP\n\nMARIANA ALBUQUERQUE TEIXEIRA, brasileira, auxiliar de produção, inscrita no CPF sob o nº 412.887.330-15, vem, por seus advogados, propor\n\nAÇÃO DE RESTABELECIMENTO DE AUXÍLIO POR INCAPACIDADE TEMPORÁRIA\n\nem face do INSTITUTO NACIONAL DO SEGURO SOCIAL – INSS, pelos fatos e fundamentos a seguir.\n\nI – DOS FATOS\n\nA autora trabalhou por 9 anos como auxiliar de produção e encontra-se afastada por LER/DORT desde 03/2025. O benefício foi negado pelo INSS em 08/2026.\n\nII – DO DIREITO\n\n[Fundamentação a completar após revisão humana.]\n\nIII – DOS PEDIDOS\n\na) o restabelecimento do auxílio por incapacidade temporária;\nb) a conversão em aposentadoria por incapacidade permanente, se constatada a incapacidade definitiva.\n\nDá-se à causa o valor de R$ [a calcular].\n\nNestes termos, pede deferimento.' },
        [caseId(2)]: {
          area: 'Previdenciário', fase: 'Revisão concluída',
          movements: [
            { id: 'mv1', cnj: '5004821-37.2026.4.03.6183', data: day(0), texto: 'Designada perícia médica para 11/11/2026 às 14h30.', prazo: day(22), concluido: false, aviso: true, tipo: 'perícia', eventoData: '2026-11-11', nova: true },
            { id: 'mv2', cnj: '1012334-08.2025.8.26.0100', data: day(-6), texto: 'Intimação para manifestação sobre cálculos de liquidação.', prazo: day(3), concluido: false, fatal: true },
          ],
        },
        [caseId(4)]: { area: 'Trabalhista', fase: 'A preparar', pendencias: ['Comprovante de residência ilegível'] },
      },
      training: { instrucoes: 'Responda com clareza e acolhimento. Não prometa resultados. Encaminhe questões jurídicas à advogada responsável.', proibidos: ['garantia de resultado', 'prazo de pagamento', 'valor da causa', 'honorários', 'ganhar'], exemplos: [], versoes: [] },
    },
  });
  // Helena já tem checklist e minuta aprovadas (caso em andamento).
  db.legal_approvals.push({ caso_id: caseId(2), kind: 'checklist', revision: '*' }, { caso_id: caseId(2), kind: 'draft', revision: '*' });
  return db;
}

let db: Record<string, Row[]> = (() => { const s = store.get(KEY); if (s) { try { return JSON.parse(s); } catch { /* recria */ } } return seedDb(); })();
const persist = () => store.set(KEY, JSON.stringify(db));
export function resetDemo() { store.del(KEY); db = seedDb(); persist(); }

const user = { id: USER, email: 'carolina@cslawyers.com.br', user_metadata: { full_name: 'Dra. Carolina Santos' }, app_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() };
const session = () => ({ access_token: 'demo.preview.token', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user });
const loggedIn = () => store.get(SESSION_KEY) === '1';
const ok = (data: any) => ({ data, error: null });
const fail = (message: string) => ({ data: null, error: { message } });
const listeners = new Set<(e: string, s: any) => void>();
const emit = (e: string) => setTimeout(() => listeners.forEach((l) => l(e, loggedIn() ? session() : null)), 0);

class Query implements PromiseLike<any> {
  private filters: ((r: Row) => boolean)[] = [];
  private sort?: [string, boolean];
  private mode: 'select' | 'insert' | 'update' | 'upsert' | 'delete' = 'select';
  private payload: any;
  private one?: 'single' | 'maybe';
  constructor(private table: string) { db[table] ??= []; }
  select() { return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, v: any[]) { this.filters.push((r) => v.includes(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  match(o: Row) { Object.entries(o).forEach(([c, v]) => this.eq(c, v)); return this; }
  filter(c: string, _op: string, v: any) { return this.eq(c, v); }
  gte() { return this; } lte() { return this; } limit() { return this; } range() { return this; }
  order(c: string, o?: { ascending?: boolean }) { this.sort = [c, o?.ascending !== false]; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  insert(p: any) { this.mode = 'insert'; this.payload = p; return this; }
  update(p: any) { this.mode = 'update'; this.payload = p; return this; }
  upsert(p: any) { this.mode = 'upsert'; this.payload = p; return this; }
  delete() { this.mode = 'delete'; return this; }
  private run() {
    const t = db[this.table]!;
    const match = (r: Row) => this.filters.every((f) => f(r));
    let out: Row[];
    if (this.mode === 'insert') { const arr: Row[] = [].concat(this.payload); arr.forEach((r) => { r.id ??= crypto.randomUUID(); r.updated_at ??= new Date().toISOString(); r.ordem ??= t.length; }); t.push(...structuredClone(arr)); out = arr; }
    else if (this.mode === 'update') { out = t.filter(match); out.forEach((r) => Object.assign(r, structuredClone(this.payload))); }
    else if (this.mode === 'upsert') {
      out = [].concat(this.payload);
      out.forEach((p) => { const key = p.id ? 'id' : p.owner_id ? 'owner_id' : 'caso_id'; const ex = t.find((r) => r[key] === p[key]); ex ? Object.assign(ex, structuredClone(p)) : t.push(structuredClone(p)); });
    } else if (this.mode === 'delete') { out = t.filter(match); db[this.table] = t.filter((r) => !match(r)); }
    else out = t.filter(match).map((r) => structuredClone(r));
    if (this.mode !== 'select') persist();
    if (this.sort) { const [c, asc] = this.sort; out.sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
    if (this.one) {
      if (!out.length && this.one === 'single') return fail('Registro não encontrado');
      return ok(out[0] ?? null);
    }
    return ok(out);
  }
  then<A, B>(res?: ((v: any) => A) | null, rej?: ((e: any) => B) | null) { return Promise.resolve(this.run()).then(res, rej); }
}

// Revisão do material: editar checklist ou minuta invalida a aprovação (como no banco real).
const ws = () => db.office_workspace.find((w) => w.owner_id === USER)!.dados;
function revision(c: string, kind: string) {
  if (kind === 'checklist') return JSON.stringify(db.checklist_itens.filter((i) => i.caso_id === c).map((i) => [i.nome, i.recebido]));
  return String(ws().casos?.[c]?.peticao ?? '');
}
const approved = (c: string, kind: string) => db.legal_approvals.some((a) => a.caso_id === c && a.kind === kind && (a.revision === '*' || a.revision === revision(c, kind)));

function rpc(name: string, args: any = {}) {
  const r = (() => {
    if (name === 'material_status') return ok({ checklist: approved(args.p_case, 'checklist'), draft: approved(args.p_case, 'draft'), canApprove: true });
    if (name === 'approve_material') {
      const c = args.p_case;
      if (args.p_kind === 'checklist') { const itens = db.checklist_itens.filter((i) => i.caso_id === c); if (!itens.length || itens.some((i) => !i.recebido)) return fail('Checklist incompleto'); }
      if (args.p_kind === 'draft' && (!approved(c, 'checklist') || !String(ws().casos?.[c]?.peticao ?? '').trim())) return fail('A minuta exige checklist aprovado e texto salvo');
      db.legal_approvals.push({ caso_id: c, kind: args.p_kind, revision: revision(c, args.p_kind) });
      return ok(null);
    }
    if (name === 'draft_approval_queue') {
      const casos = ws().casos ?? {};
      const rows = db.casos.filter((c) => String(casos[c.id]?.peticao ?? '').trim()).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => {
        const a = db.draft_review_assignments.find((x) => x.caso_id === c.id);
        return { id: c.id, name: c.nome, ownerId: c.owner_id, ownerName: 'Dra. Carolina Santos', lawyerId: a?.lawyer_id ?? null, dueDate: a?.due_date ?? null, draft: casos[c.id].peticao, checklistApproved: approved(c.id, 'checklist'), draftApproved: approved(c.id, 'draft'), previousApproval: db.legal_approvals.some((x) => x.caso_id === c.id && x.kind === 'draft'), updatedAt: c.updated_at, mine: true };
      });
      return ok({ entireOffice: true, rows, lawyers: [{ id: USER, name: 'Dra. Carolina Santos' }, { id: LAWYER2, name: 'Dr. Rafael Costa' }], updatedAt: new Date().toISOString() });
    }
    if (name === 'schedule_draft_review') {
      db.draft_review_assignments = db.draft_review_assignments.filter((x) => x.caso_id !== args.p_case);
      db.draft_review_assignments.push({ caso_id: args.p_case, lawyer_id: args.p_lawyer ?? null, due_date: args.p_due ?? null });
      return ok(null);
    }
    return ok(null);
  })();
  persist();
  return Promise.resolve(r);
}

const toB64 = async (b: Blob) => { const bytes = new Uint8Array(await b.arrayBuffer()); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };

export function createClient(..._a: any[]) {
  return {
    from: (t: string) => new Query(t),
    rpc,
    auth: {
      getUser: async () => ok({ user: loggedIn() ? user : null }),
      getSession: async () => ok({ session: loggedIn() ? session() : null }),
      getClaims: async () => ok({ claims: { sub: USER, email: user.email } }),
      onAuthStateChange: (cb: any) => { listeners.add(cb); return { data: { subscription: { unsubscribe() { listeners.delete(cb); } } } }; },
      signInWithPassword: async () => { store.set(SESSION_KEY, '1'); emit('SIGNED_IN'); return ok({ user, session: session() }); },
      signUp: async () => { store.set(SESSION_KEY, '1'); emit('SIGNED_IN'); return ok({ user, session: session() }); },
      setSession: async () => { store.set(SESSION_KEY, '1'); emit('SIGNED_IN'); return ok({ session: session() }); },
      signOut: async () => { store.del(SESSION_KEY); emit('SIGNED_OUT'); return { error: null }; },
    },
    storage: {
      from: () => ({
        // Arquivos ficam só nesta sessão do navegador (base64 até ~2 MB para caber no armazenamento local).
        upload: async (path: string, file: Blob) => { const small = file.size < 2_000_000; db.files.push({ path, type: file.type, b64: small ? await toB64(file) : null }); persist(); return ok({ path }); },
        download: async (path: string) => {
          const f = db.files.find((x) => x.path === path);
          if (f?.b64) { const bin = atob(f.b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return ok(new Blob([u], { type: f.type })); }
          return ok(new Blob(['Arquivo de demonstração'], { type: f?.type || 'application/pdf' }));
        },
        remove: async () => ok([]),
        createSignedUrl: async () => ok({ signedUrl: '#' }),
      }),
    },
    functions: { invoke: async () => ok(null) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  };
}
export default { createClient };
