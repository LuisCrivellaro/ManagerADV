import { createFileRoute } from '@tanstack/react-router';
import { TrainingPage } from '@/components/office/training';
export const Route = createFileRoute('/_authenticated/treinamento')({
 head: () => ({meta: [{title: 'Treinamento de IA — Manager ADV'},{name:'description',content:'Orientações versionadas e testes de respostas jurídicas no Manager ADV.'},{property:'og:title',content:'Treinamento de IA — Manager ADV'},{property:'og:description',content:'Orientações versionadas e testes de respostas jurídicas no Manager ADV.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: TrainingPage,
});
