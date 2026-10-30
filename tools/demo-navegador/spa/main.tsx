import '@/styles.css';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter, createMemoryHistory } from '@tanstack/react-router';
import { QueryClient } from '@tanstack/react-query';
import { routeTree } from '@/routeTree.gen';
import { resetDemo } from '../supabase-fake';

// O "shell" HTML do TanStack Start só existe no servidor; aqui o app monta direto na página.
(routeTree as any).options.shellComponent = undefined;

const queryClient = new QueryClient();
const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: ['/'] }), scrollRestoration: true, defaultPreloadStaleTime: 0 });

createRoot(document.getElementById('app')!).render(<StrictMode><RouterProvider router={router} /></StrictMode>);

// Só na demonstração: comparar combinações de fontes ao vivo antes de decidir a do sistema real.
const FONTES = [
  { id: 'atual', nome: 'Atual', desc: 'EB Garamond + Inter', titulo: '"EB Garamond", Georgia, serif', texto: '"Inter", system-ui, sans-serif' },
  { id: 'tradicional', nome: 'Tradicional', desc: 'Times New Roman + Arial', titulo: '"Times New Roman", Tinos, Times, serif', texto: 'Arial, Arimo, Helvetica, sans-serif' },
  { id: 'baskerville', nome: 'Baskerville', desc: 'Libre Baskerville + Source Sans 3', titulo: '"Libre Baskerville", Baskerville, Georgia, serif', texto: '"Source Sans 3", system-ui, sans-serif' },
  { id: 'playfair', nome: 'Playfair', desc: 'Playfair Display + Lato', titulo: '"Playfair Display", Georgia, serif', texto: 'Lato, system-ui, sans-serif' },
  { id: 'merriweather', nome: 'Merriweather', desc: 'Merriweather + Roboto', titulo: 'Merriweather, Georgia, serif', texto: 'Roboto, system-ui, sans-serif' },
] as const;
type FonteId = typeof FONTES[number]['id'];
const fonteStyle = document.createElement('style');
document.head.appendChild(fonteStyle);
function aplicarFonte(id: FonteId) {
  const f = FONTES.find(f => f.id === id) ?? FONTES[0];
  // Títulos e marca na fonte de título; textos da interface na fonte de texto. A folha da petição (Times) não muda.
  fonteStyle.textContent = id === 'atual' ? '' : `#app h1, #app h2, #app h3, #app .font-serif, #app .brand-lockup, #app .section-title { font-family: ${f.titulo} !important; } #app, #app .font-sans, #app .brand-cities, #app input, #app textarea, #app button, #app select { font-family: ${f.texto} !important; } #app .legal-copy, #app .legal-copy * { font-family: var(--font-doc) !important; }`;
  try { localStorage.setItem('demo-fonte', id); } catch { /* sem armazenamento */ }
}
let fonteInicial: FonteId = 'atual';
try { const v = localStorage.getItem('demo-fonte'); if (FONTES.some(f => f.id === v)) fonteInicial = v as FonteId; } catch { /* sem armazenamento */ }
aplicarFonte(fonteInicial);

function DemoBar() {
  const [open, setOpen] = useState(true);
  const [ask, setAsk] = useState(false);
  const [fonte, setFonte] = useState<FonteId>(fonteInicial);
  const s: React.CSSProperties = { position: 'fixed', right: 'calc(12px + env(safe-area-inset-right, 0px))', bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 60, fontFamily: 'Inter, system-ui, sans-serif', fontSize: 12, background: '#0F3533', color: '#E6F2F1', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.18)' };
  const btn: React.CSSProperties = { borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 };
  const primary: React.CSSProperties = { ...btn, background: '#00ACA7', color: '#062120', border: 0, fontWeight: 600 };
  const ghost: React.CSSProperties = { ...btn, background: 'transparent', color: '#e8f6f4', border: '1px solid #3E6C69' };
  if (!open) return <button style={{ ...s, padding: '6px 10px', border: 0, cursor: 'pointer' }} onClick={() => setOpen(true)}>Demonstração</button>;
  return (
    <div style={{ ...s, padding: '10px 12px', maxWidth: 300, lineHeight: 1.45 }}>
      {ask ? <>Apagar tudo o que você alterou e voltar aos dados iniciais?</> : <><b>Versão de demonstração</b>: dados fictícios, IA e integrações simuladas, nada é enviado para fora. Para entrar, use qualquer e-mail e uma senha de 6 caracteres ou mais.</>}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        {ask
          ? <><button style={primary} onClick={() => { resetDemo(); location.reload(); }}>Sim, restaurar</button><button style={ghost} onClick={() => setAsk(false)}>Cancelar</button></>
          : <><button style={primary} onClick={() => setAsk(true)}>Restaurar dados</button><button style={ghost} onClick={() => setOpen(false)}>Ocultar</button></>}
      </div>
      {!ask && <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #24524F' }}>
        <div style={{ marginBottom: 6 }}><b>Fontes</b> <span style={{ color: '#9FC3C0' }}>· {FONTES.find(f => f.id === fonte)?.desc}</span></div>
        <div role="radiogroup" aria-label="Combinação de fontes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {FONTES.map(f => <button key={f.id} role="radio" aria-checked={fonte === f.id} style={fonte === f.id ? primary : ghost} onClick={() => { setFonte(f.id); aplicarFonte(f.id); }}>{f.nome}</button>)}
        </div>
      </div>}
    </div>
  );
}
createRoot(document.getElementById('demo-bar')!).render(<DemoBar />);
