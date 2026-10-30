import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { viteSingleFile } from 'vite-plugin-singlefile';

const here = (f: string) => path.resolve(__dirname, f);
const src = path.resolve(__dirname, '../../src');

export default defineConfig({
  root: here('spa'),
  base: './',
  envDir: here('.'),
  plugins: [
    { name: 'demo-legal-ai', enforce: 'pre', resolveId(source) { if (/legal\/ai\.server(\.ts)?$/.test(source)) return here('legal-ai-fake.ts'); } },
    react(), tailwindcss(), viteSingleFile(),
  ],
  resolve: {
    alias: [
      { find: /^@supabase\/supabase-js$/, replacement: here('supabase-fake.ts') },
      { find: /^@tanstack\/react-start\/server$/, replacement: here('start-server-shim.ts') },
      { find: /^@tanstack\/react-start$/, replacement: here('start-shim.ts') },
      { find: /^@lovable\.dev\/cloud-auth-js$/, replacement: here('lovable-auth-fake.ts') },
      { find: /^ai$/, replacement: here('ai-fake.ts') },
      { find: /^@ai-sdk\/openai$/, replacement: here('openai-fake.ts') },
      { find: /^@\//, replacement: src + '/' },
    ],
    dedupe: ['react', 'react-dom', '@tanstack/react-router', '@tanstack/react-query'],
  },
  define: { 'process.env': JSON.stringify({ LOVABLE_API_KEY: 'demo', SUPABASE_URL: 'http://demo.local', SUPABASE_PUBLISHABLE_KEY: 'demo', SUPABASE_SERVICE_ROLE_KEY: 'demo' }) },
  build: { outDir: here('dist'), emptyOutDir: true, chunkSizeWarningLimit: 10000 },
  server: { port: 8090, host: '127.0.0.1' },
});
