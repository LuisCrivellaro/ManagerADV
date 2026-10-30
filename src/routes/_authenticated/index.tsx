import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from '@/components/office/dashboard';

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Painel de casos — Manager ADV" }, { name: "description", content: "Status, responsáveis, prazos e pendências do escritório CS Lawyers." }, { property: "og:title", content: "Painel de casos — Manager ADV" }, { property: "og:description", content: "Status, responsáveis, prazos e pendências do escritório CS Lawyers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: DashboardPage,
});
