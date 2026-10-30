import { Document, Paragraph, TextRun, Header, Footer, AlignmentType, BorderStyle, TabStopType, Table, TableRow, TableCell, WidthType, type IParagraphOptions } from 'docx';
import { documentBlocks, documentColors as colors, documentLayout as layout } from './visual-law';
export function createPetitionDocument(text:string){
 const children=documentBlocks(text).map((b,i,blocks)=>{
  if(b.kind==='table')return new Table({width:{size:100,type:WidthType.PERCENTAGE},borders:{top:{style:BorderStyle.NONE,size:0,color:colors.rule},bottom:{style:BorderStyle.NONE,size:0,color:colors.rule},left:{style:BorderStyle.NONE,size:0,color:colors.rule},right:{style:BorderStyle.NONE,size:0,color:colors.rule},insideVertical:{style:BorderStyle.NONE,size:0,color:colors.rule},insideHorizontal:{style:BorderStyle.SINGLE,size:4,color:colors.rule}},rows:b.rows.map((r,j)=>new TableRow({tableHeader:j===0,children:r.map(v=>new TableCell({...(j===0?{shading:{fill:colors.aqua}}:{}),children:[new Paragraph({children:[new TextRun({text:v,font:'Times New Roman',size:19,bold:j===0,color:j===0?colors.paper:colors.ink})]})]}))}))});
  const isHeading=['title','heading1','heading2','address'].includes(b.kind);
  const closing=/^(Termos em que|pede deferimento|DRA\. CAROLINA|OAB\/SP)/i.test(b.text);
  const options:IParagraphOptions={alignment:b.kind==='title'?AlignmentType.CENTER:b.kind==='heading1'||b.kind==='heading2'?AlignmentType.LEFT:AlignmentType.JUSTIFIED,
   indent:b.kind==='body'?{firstLine:layout.firstLine}:b.kind==='quote'?{left:2268}:b.kind==='list'?{left:709,hanging:425}:{firstLine:0},
   spacing:{line:b.kind==='quote'?240:layout.line,after:b.kind==='title'?360:b.kind==='heading1'?200:b.kind==='heading2'?100:layout.after,before:b.kind==='title'||b.kind==='heading1'?360:b.kind==='heading2'?200:0},
   keepNext:isHeading||(closing&&i<blocks.length-1),
   ...(b.kind==='heading1'?{shading:{fill:colors.pale},border:{left:{color:colors.aqua,size:24,style:BorderStyle.SINGLE}}}:{}),
   children:[new TextRun({text:b.text,font:'Times New Roman',size:b.kind==='title'?30:b.kind==='quote'?20:b.kind==='heading1'||b.kind==='heading2'?23:layout.bodySize,bold:isHeading,italics:b.kind==='quote',color:b.kind==='title'||b.kind==='heading2'?colors.aqua:colors.ink})]};
  return new Paragraph(options);
 });
 return new Document({sections:[{properties:{page:{size:{width:layout.width,height:layout.height},margin:{top:layout.top,bottom:layout.bottom,left:layout.left,right:layout.right,header:layout.header,footer:layout.footer}}},
  headers:{default:new Header({children:[new Paragraph({tabStops:[{type:TabStopType.RIGHT,position:8504}],border:{bottom:{color:colors.aqua,size:4,style:BorderStyle.SINGLE}},children:[new TextRun({text:'CS LAWYERS | ADVOCACIA',font:'Garamond',size:20,bold:true,color:colors.soft}),new TextRun({text:'\tBRASIL • DUBAI • PORTUGAL',font:'Garamond',size:16,bold:true,color:colors.aqua})]})]})},
  footers:{default:new Footer({children:[new Paragraph({tabStops:[{type:TabStopType.RIGHT,position:8504}],border:{top:{color:colors.ink,size:4,style:BorderStyle.SINGLE}},children:[new TextRun({text:'CS LAWYERS | carolinasantos.com.br',font:'Garamond',size:16,color:colors.aqua}),new TextRun({text:'\tcontato@carolinasantos.com.br | (11) 91858-2706',font:'Garamond',size:16,color:colors.soft})]})]})},children}]});
}