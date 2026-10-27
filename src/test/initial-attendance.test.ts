import { describe, expect, it } from 'vitest';
import { iniciarAtendimentoAutomatico } from '@/lib/atendimento/initial-attendance';
import { conversas } from '@/lib/mock-data';

const fixture=conversas[0];
if(!fixture)throw new Error('Fixture missing');
const {modoIA:_mode,agenteAna:_ana,...base}=fixture;
const inicial={...base,mensagens:[]};
describe('início automático do atendimento',()=>{
  it('nova conversa começa em Automática sem ativação humana',()=>expect(iniciarAtendimentoAutomatico(inicial).modoIA).toBe('Automática'));
  it.each(['Desligada','Sugerir','Automática'] as const)('preserva escolha explícita %s',modoIA=>expect(iniciarAtendimentoAutomatico({...inicial,modoIA}).modoIA).toBe(modoIA));
  it('não supera pausa de segurança',()=>expect(iniciarAtendimentoAutomatico({...inicial,agenteAna:{pausa:true}}).modoIA).toBeUndefined());
  it('não supera tomada humana',()=>expect(iniciarAtendimentoAutomatico({...inicial,agenteAna:{humano:true}}).modoIA).toBeUndefined());
});