import { createFileRoute } from '@tanstack/react-router';
import { MovementsPage } from '@/components/office/movements';
export const Route = createFileRoute('/_authenticated/andamentos')({
 head: () => ({meta: [{title: 'Andamentos — Manager ADV'},{name:'description',content:'Movimentações e prazos por processo no Manager ADV.'},{property:'og:title',content:'Andamentos — Manager ADV'},{property:'og:description',content:'Movimentações e prazos por processo no Manager ADV.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: MovementsPage,
});
