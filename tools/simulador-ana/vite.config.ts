// Gera o Simulador da Ana como um único HTML. Não faz parte do sistema publicado.
// Uso (na raiz, com dependências instaladas):
//   bun add -d vite-plugin-singlefile   (temporário; não versionar)
//   bunx vite build --config tools/simulador-ana/vite.config.ts
import { defineConfig } from 'vite';
import path from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (f: string) => path.resolve(__dirname, f);
export default defineConfig({
  root: here('.'),
  base: './',
  plugins: [viteSingleFile()],
  resolve: { alias: [{ find: /^@\//, replacement: path.resolve(__dirname, '../../src') + '/' }] },
  define: { 'process.env': '{}' },
  build: { outDir: here('dist'), emptyOutDir: true, chunkSizeWarningLimit: 10000, target: 'es2022' },
});
