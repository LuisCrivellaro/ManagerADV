export const documentLayout = { width:11906, height:16838, top:1417, bottom:1417, left:1701, right:1701, header:709, footer:709, bodySize:24, line:360, firstLine:1417, after:120 } as const;
// Export colors cannot read browser CSS during server rendering; keep document roles here.
export const documentColors = { aqua:'00ACA7', pale:'E9F7F6', rule:'CFE9E7', ink:'000000', soft:'0D0D0D', paper:'FFFFFF' } as const;
export type DocumentBlock={kind:'body'|'heading1'|'heading2'|'title'|'address'|'quote'|'list';text:string}|{kind:'table';rows:string[][]};
export function documentBlocks(text:string):DocumentBlock[]{
 const blocks:DocumentBlock[]=[];const lines=text.split('\n');
 for(let i=0;i<lines.length;i++){
  const raw=lines[i]??'';const t=raw.trim();
  if(t.startsWith('|')&&t.endsWith('|')){const rows:string[][]=[];while(i<lines.length){const row=(lines[i]??'').trim();if(!row.startsWith('|')||!row.endsWith('|'))break;if(!/^\|[\s:|\-]+\|$/.test(row))rows.push(row.slice(1,-1).split('|').map(c=>c.trim()));i++;}i--;if(rows.length)blocks.push({kind:'table',rows});continue;}
  const stripped=t.replace(/^#{1,6}\s+/,'');
  const kind=/^(AO JU[IÍ]ZO|EXCELENT[IÍ]SSIM)/i.test(stripped)?'address':/^[IVXLCDM]+[.\-–—)]\s+/.test(stripped)?'heading1':/^\d+\.\d+[.\s]/.test(stripped)?'heading2':/^#\s/.test(t)?'title':/^##\s/.test(t)?'heading1':/^###\s/.test(t)?'heading2':/^>\s/.test(t)?'quote':/^[a-z]\)\s/.test(stripped)?'list':'body';
  blocks.push({kind,text:kind==='quote'?stripped.replace(/^>\s/,''):stripped});
 }
 return blocks;
}