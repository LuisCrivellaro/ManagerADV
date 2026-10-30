import { describe, it, expect } from 'vitest';
import { finalAllowed, MAX_FINAL_BYTES, reviewReady, readiness, newReview, paulistaReference, safeName, type CaseFile, type OfficeCase } from '@/lib/office';
const file: CaseFile = {id:'f',nome:'documento.pdf',path:'original',mime:'application/pdf',bytes:MAX_FINAL_BYTES,hash:'hash',revisado:true,contrato:false,classe:'B',destino:'copy',analise:{tipoDocumento:'RG',itemChecklist:'RG ou CNH',confianca:'alta',nomeTitular:null,cpf:null,datas:[],detalhesCaso:[],observacoes:null}};
const ready: OfficeCase={peticao:'Minuta integral',arquivos:[file],revisao:newReview().map(r=>({...r,status:'SIM',constatacao:'Conferido',localizacao:'Documento, página 1'})),pendencias:[]};
describe('Regras dos prompts CS Lawyers',()=>{
 it('exclui contrato cliente/advocacia mesmo com conteúdo conferido',()=>{expect(finalAllowed({...file,contrato:true})).toBe(false);});
 it('aceita no máximo 10.000 KB no arquivo final',()=>{expect(MAX_FINAL_BYTES).toBe(10_000*1024);expect(finalAllowed(file)).toBe(true);expect(finalAllowed({...file,bytes:MAX_FINAL_BYTES+1})).toBe(false);});
 it('encaminha classificação E para revisão manual',()=>{expect(finalAllowed({...file,classe:'E'})).toBe(false);});
 it('não libera arquivo sem conteúdo analisado',()=>{const {analise: _a,...unread}=file;expect(finalAllowed(unread)).toBe(false);});
 it('pendência impeditiva bloqueia a liberação',()=>{expect(reviewReady(ready)).toBe(true);const blocked={...ready,pendencias:['Procuração ausente']};expect(reviewReady(blocked)).toBe(false);expect(readiness(blocked)).toBe('NÃO APTO PARA PROTOCOLO');});
 it('exige cada uma das 16 categorias de revisão',()=>{expect(newReview()).toHaveLength(16);expect(reviewReady({...ready,revisao:(ready.revisao??[]).slice(1)})).toBe(false);});
 it('não confunde ressalvas com liberação definitiva',()=>{const pending={...ready,revisao:newReview()};expect(reviewReady(pending)).toBe(false);expect(readiness(pending)).toBe('APTO COM RESSALVAS — VALIDAÇÃO DO ADVOGADO');});
 it('exige fonte de conferência para cada item',()=>{expect(reviewReady({...ready,revisao:(ready.revisao??[]).map(r=>({...r,localizacao:''}))})).toBe(false);});
 it('não aplica orientação paulista de R$ 1.874,36 universalmente',()=>{expect(paulistaReference(false)).toBeNull();expect(paulistaReference(true)).toBe(1874.36);});
 it('preserva nomenclatura em maiúsculas sem acentos ou caracteres proibidos',()=>{expect(safeName('05 certidão: filha.pdf')).toBe('05 CERTIDAO FILHA.PDF');});
});