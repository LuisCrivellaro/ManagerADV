import { createFileRoute } from '@tanstack/react-router';

const retired = () => new Response('Telegram retirado do atendimento.', { status: 410 });
export const Route = createFileRoute('/api/public/atendimento/telegram')({
  server: { handlers: { GET: retired, POST: retired } },
});
