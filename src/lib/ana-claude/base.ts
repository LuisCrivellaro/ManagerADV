// Funções auxiliares copiadas do Manager ADV (src/lib/atendimento.ts), para o pacote não depender de mudanças no projeto.
export type AIMode = 'Desligada' | 'Sugerir' | 'Automática';
export function normalized(s:string){return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
export function forbiddenTopics(text:string,topics:string[]){return topics.filter(t=>t.trim()&&normalized(text).includes(normalized(t)));}
function horarioParts(iso:string){const d=new Date(iso);if(!Number.isFinite(d.getTime()))return undefined;return Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',weekday:'long',day:'2-digit',month:'2-digit',hour:'numeric',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));}
export function formatarHorarioCliente(iso:string){const p=horarioParts(iso);if(!p)return '';const weekday=p['weekday']??'';return `${weekday.charAt(0).toUpperCase()+weekday.slice(1)}, ${p['day']}/${p['month']}, às ${Number(p['hour'])}h${p['minute']==='00'?'':p['minute']}`;}
export function dataHoraCurta(iso:string|undefined){if(!iso)return '';const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';const p=Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(x=>[x.type,x.value]));return `${p['day']}/${p['month']}/${p['year']} · ${p['hour']}:${p['minute']}`;}
export function mensagemPermitida(text:string){return !/link\s+nao\s+registrado/i.test(text.normalize('NFD').replace(/[\u0300-\u036f]/g,''));}
export function chosenSlot(offered:string[],text:string){
 const unique=[...new Set(offered)];const exact=unique.filter(h=>text.includes(h));if(exact.length)return exact.length===1?exact[0]:undefined;
 const folded=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const times=[...folded.matchAll(/\b(\d{1,2})(?:h(\d{2})?|:(\d{2}))\b/g)].map(m=>({hour:Number(m[1]),minute:Number(m[2]??m[3]??0)}));
 if(times.length!==1||times[0]?.hour===undefined||times[0].hour>23||times[0].minute>59)return undefined;
 const dates=[...folded.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/\d{4})?\b/g)];const days=[...folded.matchAll(/\bdia\s+(\d{1,2})\b/g)];const weekdays=[...folded.matchAll(/\b(domingo|segunda|terca|quarta|quinta|sexta|sabado)(?:-feira)?\b/g)];
 const matches=unique.filter(iso=>{const p=horarioParts(iso);return p&&Number(p['hour'])===times[0]?.hour&&Number(p['minute'])===times[0]?.minute&&dates.every(m=>Number(p['day'])===Number(m[1])&&Number(p['month'])===Number(m[2]))&&days.every(m=>Number(p['day'])===Number(m[1]))&&weekdays.every(m=>normalized(p['weekday']??'').startsWith(m[1]??''));});
 return matches.length===1?matches[0]:undefined;
}
/** Mesma validação de texto de envio do Manager ADV (canal-envio.ts). */
export function validarTextoEnvio(texto: string): string | null {
  if (!texto.trim()) return 'A mensagem está vazia.';
  if (/\{[^{}\n]{1,40}\}/.test(texto)) return 'Preencha todos os campos entre chaves antes de enviar.';
  if (!mensagemPermitida(texto)) return 'Registre o link do contrato antes de enviar.';
  return null;
}
