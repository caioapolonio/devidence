import { LlmCredentialsForm } from "@/components/LlmCredentialsForm";
import { PageHeader } from "@/components/PageHeader";

export default function ConfiguracoesPage() {
  return (
    <>
      <PageHeader
        title="Configurações"
        subtitle="O relatório é gerado com a sua própria chave de API, então o custo é seu e você escolhe o modelo."
      />

      <LlmCredentialsForm />

      <section className="mt-10 max-w-2xl space-y-3 border-t border-black/10 pt-6 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        <h2 className="font-medium text-black/80 dark:text-white/80">
          O que acontece com a sua chave
        </h2>
        <p>
          Ela fica <strong>apenas</strong> dentro do cookie de sessão cifrado, no
          seu navegador — o mesmo tratamento dado ao token do GitHub. Não existe
          banco de credenciais neste projeto. Ao sair, ou ao clicar em remover, a
          chave some junto.
        </p>
        <p>
          Antes de salvar, o app faz uma chamada mínima ao modelo escolhido para
          confirmar que ele devolve saída estruturada. Sem isso não há como
          garantir que cada afirmação do relatório venha ligada a uma evidência —
          e um relatório que parece certo mas não é seria pior que nenhum.
        </p>
      </section>
    </>
  );
}
