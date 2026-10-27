import { createFileRoute } from '@tanstack/react-router';
import { ApprovalsPage } from '@/components/office/approvals';
export const Route = createFileRoute('/_authenticated/aprovacoes')({
  head: () => ({ meta: [
    { title: 'Aprovações de minutas — Manager ADV' },
    { name: 'description', content: 'Fila de minutas por advogado, status da aprovação jurídica e prazos do escritório CS Lawyers.' },
    { property: 'og:title', content: 'Aprovações de minutas — Manager ADV' },
    { property: 'og:description', content: 'Acompanhe minutas pendentes, advogados revisores e prazos de aprovação.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ApprovalsPage,
});