import { PageHeader } from "@/components/PageHeader";
import { limits } from "@/lib/nav";

export default function SettingsPage() {
  return (
    <PageHeader
      title="Configurações"
      subtitle={`Instalação do GitHub App, seleção de até ${limits.maxRepositories} repositórios e identidade de atribuição.`}
      pending="Preenchida junto com o fluxo de login e instalação do GitHub App."
    />
  );
}
