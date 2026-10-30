import { createFileRoute } from '@tanstack/react-router';
import { ApprovalsPage } from '@/components/office/approvals';
export const Route = createFileRoute('/_authenticated/aprovacoes')({
  head: () => ({ meta: [
    { title: 'Aprovações de minutas e notícias processuais — Manager ADV' },
    { name: 'description', content: 'Revisão de notícias processuais e minutas, com aprovações e prazos do escritório CS Lawyers.' },
    { property: 'og:title', content: 'Aprovações de minutas e notícias processuais — Manager ADV' },
    { property: 'og:description', content: 'Acompanhe notícias processuais e minutas pendentes de aprovação.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ApprovalsPage,
});