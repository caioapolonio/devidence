import { redirect } from "next/navigation";

import type { AuthFailure } from "@/lib/auth/github-oauth";
import { getCurrentUser } from "@/lib/session";

const MENSAGENS: Record<AuthFailure, string> = {
  acesso_negado: "Você recusou a autorização no GitHub. Nada foi acessado.",
  estado_invalido:
    "O retorno do GitHub não conferiu com o pedido que saiu daqui. Por segurança, o login foi descartado — tente de novo.",
  troca_falhou:
    "O GitHub não confirmou a autorização. Tente de novo em alguns instantes.",
  usuario_indisponivel:
    "A autorização funcionou, mas não foi possível ler seu perfil no GitHub.",
};

function mensagemDeErro(erro: string | undefined): string | null {
  if (!erro) return null;
  return MENSAGENS[erro as AuthFailure] ?? MENSAGENS.troca_falhou;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");

  const erro = mensagemDeErro((await searchParams).erro);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">devidence</h1>
      <p className="mt-2 text-black/70 dark:text-white/70">
        Gera um relatório em PDF sobre a sua contribuição em um projeto, a
        partir de atividade verificável do GitHub.
      </p>

      {erro && (
        <p
          role="alert"
          className="mt-6 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {erro}
        </p>
      )}

      <a
        href="/api/auth/login"
        className="mt-8 inline-flex items-center justify-center rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
      >
        Entrar com GitHub
      </a>

      <section className="mt-10 space-y-4 border-t border-black/10 pt-6 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        <h2 className="font-medium text-black/80 dark:text-white/80">
          O que é pedido, e por quê
        </h2>
        <p>
          O GitHub vai pedir permissão de <strong>leitura do seu perfil</strong>{" "}
          e de <strong>acesso a repositórios</strong>. O acesso a repositórios é
          amplo porque o OAuth do GitHub não oferece meio-termo: ou é só
          repositório público, ou é acesso completo. Como o uso real é relatar
          trabalho feito em repositório privado de cliente, o app pede o acesso
          completo.
        </p>
        <p>
          <strong>Seu token não é guardado em lugar nenhum.</strong> Ele fica
          apenas dentro do cookie de sessão cifrado, no seu navegador, e é usado
          só durante os pedidos que você mesmo inicia. Não há banco de tokens,
          nem sincronização rodando por trás. Ao sair, o token some junto.
        </p>
        <p>
          Você pode revogar o acesso quando quiser em{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/settings/applications"
            target="_blank"
            rel="noreferrer"
          >
            Applications
          </a>{" "}
          nas configurações do GitHub.
        </p>
      </section>
    </main>
  );
}
