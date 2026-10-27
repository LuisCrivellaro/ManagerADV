import { createFileRoute } from '@tanstack/react-router';
import { ProductionPage } from '@/components/office/production';
export const Route = createFileRoute('/_authenticated/producao')({
 validateSearch: (search: Record<string,unknown>): {caseId?:string} => typeof search['caseId']==='string'?{caseId:search['caseId']}:{},
 head: () => ({meta: [{title: 'Produção — Manager ADV'},{name:'description',content:'Casos, provas, documentos e minutas do escritório CS Lawyers.'},{property:'og:title',content:'Produção — Manager ADV'},{property:'og:description',content:'Casos, provas, documentos e minutas do escritório CS Lawyers.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: ProductionPage,
});
