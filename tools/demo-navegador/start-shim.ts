// Substitui as "server functions" do TanStack Start: o código delas roda no próprio navegador
// (versão de demonstração), passando pelos mesmos middlewares e validações.
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export function createMiddleware(_o?: any) {
  const m: any = { _server: undefined, _client: undefined,
    server(fn: any) { m._server = fn; return m; }, client(fn: any) { m._client = fn; return m; }, middleware() { return m; } };
  return m;
}
export function createServerFn(_o?: any) {
  let mws: any[] = []; let validator: any;
  const b: any = {
    middleware(a: any[]) { mws = a; return b; },
    inputValidator(v: any) { validator = v; return b; },
    validator(v: any) { validator = v; return b; },
    handler(h: any) {
      return async (opts: any = {}) => {
        await wait(120);
        let data = opts?.data;
        if (validator) data = typeof validator === 'function' ? await validator(data) : typeof validator.parse === 'function' ? validator.parse(data) : data;
        let context: any = {};
        for (const m of mws) if (m?._server) await m._server({ context, data, next: async (o: any = {}) => { context = { ...context, ...(o.context ?? {}) }; return { context }; } });
        return h({ data, context });
      };
    },
  };
  return b;
}
export const useServerFn = <T,>(fn: T) => fn;
export const createStart = (f: any) => f;
export const createCsrfMiddleware = () => createMiddleware();
