import { PageHeader } from "@/components/PageHeader";
import { RepoPicker } from "@/components/RepoPicker";
import { MAX_PERIOD_DAYS } from "@/lib/period";

export default function NovoRelatorioPage() {
  return (
    <>
      <PageHeader
        title="Novo relatório"
        subtitle={`Escolha um projeto e um período de até ${MAX_PERIOD_DAYS} dias. O relatório cobre a sua contribuição, com cada afirmação ligada a um commit, PR, review, issue ou release.`}
      />
      <RepoPicker />
    </>
  );
}
