import { createFileRoute } from '@tanstack/react-router';
import { AuditPage } from '@/components/office/audit';
export const Route = createFileRoute('/_authenticated/auditoria')({
 head: () => ({meta: [{title: 'Auditoria — Manager ADV'},{name:'description',content:'Revisão individual de petições, provas e cálculos do escritório CS Lawyers.'},{property:'og:title',content:'Auditoria — Manager ADV'},{property:'og:description',content:'Revisão individual de petições, provas e cálculos do escritório CS Lawyers.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: AuditPage,
});
