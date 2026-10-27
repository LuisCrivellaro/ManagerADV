import { createFileRoute } from '@tanstack/react-router';
import { ClientsPage } from '@/components/office/clients';
import { clientsQuery } from '@/lib/clients-query';
export const Route=createFileRoute('/_authenticated/clientes')({
 validateSearch:(s:Record<string,unknown>):{clientId?:string}=>typeof s['clientId']==='string'?{clientId:s['clientId']}:{},
 loader:({context})=>context.queryClient.ensureQueryData(clientsQuery()),
 head:()=>({meta:[{title:'Clientes — Manager ADV'},{name:'description',content:'Cadastro, casos, processos, documentos e histórico dos clientes da CS Lawyers.'},{property:'og:title',content:'Clientes — Manager ADV'},{property:'og:description',content:'Cadastro e acompanhamento dos clientes da CS Lawyers.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component:ClientsPage,
});