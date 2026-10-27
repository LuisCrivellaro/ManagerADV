import { createFileRoute } from '@tanstack/react-router';
import { ProtocolPage } from '@/components/office/protocol';
export const Route = createFileRoute('/_authenticated/protocolo')({
 head: () => ({meta: [{title: 'Protocolo — Manager ADV'},{name:'description',content:'Conferência final e registro de protocolo do escritório CS Lawyers.'},{property:'og:title',content:'Protocolo — Manager ADV'},{property:'og:description',content:'Conferência final e registro de protocolo do escritório CS Lawyers.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: ProtocolPage,
});
