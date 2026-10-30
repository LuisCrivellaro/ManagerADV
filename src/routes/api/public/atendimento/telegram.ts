import { createFileRoute } from '@tanstack/react-router';

// Telegram retirado do atendimento: o atendimento real usa somente WhatsApp (UltraMsg).
const aposentado = () => new Response('Telegram retirado do atendimento', { status: 410 });

export const Route = createFileRoute('/api/public/atendimento/telegram')({
  server: { handlers: { GET: aposentado, POST: aposentado } },
});
