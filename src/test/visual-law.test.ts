import { describe, expect, it } from 'vitest';
import { documentLayout as l, documentBlocks } from '@/lib/legal/visual-law';
describe('Padrão documental do escritório',()=>{
 it('A4 e margens de 2,5 e 3 cm',()=>{expect([l.width,l.height]).toEqual([11906,16838]);expect([l.top,l.bottom,l.left,l.right]).toEqual([1417,1417,1701,1701]);});
 it('Times 12, espaçamento 1,5 e recuo 2,5 cm',()=>{expect([l.bodySize,l.line,l.firstLine,l.after]).toEqual([24,360,1417,120]);});
 it('separa títulos explícitos sem converter parágrafos em títulos',()=>{expect(documentBlocks('I. DOS FATOS\nFatos narrados.\n1.1. DA COMPETÊNCIA').map(b=>b.kind)).toEqual(['heading1','body','heading2']);});
 it('preserva valores das tabelas sem criar cálculos',()=>{expect(documentBlocks('| Item | Valor |\n|---|---|\n| A | R$ 15,00 |')).toEqual([{kind:'table',rows:[['Item','Valor'],['A','R$ 15,00']]}]);});
});