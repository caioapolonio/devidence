import { PageHeader } from "@/components/PageHeader";

export default function DashboardPage() {
  return (
    <PageHeader
      title="Visão geral"
      subtitle="Resumo do período sincronizado, cobertura dos dados e estado de cada projeto acompanhado."
      pending="Preenchida depois que o backend e a sincronização existirem."
    />
  );
}
