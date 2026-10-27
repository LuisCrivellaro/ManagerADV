import { useEffect, useRef, useState } from 'react';
import type { QuickReply } from '@/lib/respostas-prontas';
import type { ReplyCalendarData } from '@/lib/atendimento/quick-reply-calendar';
import { calendarShortcut, fillCalendarReply } from '@/lib/atendimento/quick-reply-calendar';

/** Une toutes as formas de seleção e descarta respostas após sair da conversa. */
export function useCalendarQuickReply(load: (atalho: string) => Promise<ReplyCalendarData>, insert: (r: QuickReply) => void, notify: (aviso: string) => void) {
  const [loading, setLoading] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const pick = async (r: QuickReply) => {
    if (lock.current) return;
    if (!calendarShortcut(r)) { insert(r); return; }
    lock.current = true;
    setLoading(true);
    try {
      const data = await load(r.atalho);
      if (!mounted.current) return;
      insert({ ...r, texto: fillCalendarReply(r.texto, data) });
      if (data.aviso) notify(data.aviso);
    } catch {
      if (!mounted.current) return;
      insert(r);
      notify('Não foi possível consultar a agenda. Os campos permanecem para preenchimento manual.');
    } finally { lock.current = false; if (mounted.current) setLoading(false); }
  };
  return { pick, loading };
}