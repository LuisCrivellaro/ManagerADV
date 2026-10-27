import { createFileRoute } from '@tanstack/react-router';
import { SettingsPage } from '@/components/office/settings';
export const Route = createFileRoute('/_authenticated/configuracoes')({
 head: () => ({meta: [{title: 'Configurações — Manager ADV'},{name:'description',content:'Perfil da equipe, segurança documental e integrações do Manager ADV.'},{property:'og:title',content:'Configurações — Manager ADV'},{property:'og:description',content:'Perfil da equipe, segurança documental e integrações do Manager ADV.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 component: SettingsPage,
});
