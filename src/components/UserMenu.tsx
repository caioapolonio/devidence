/* eslint-disable @next/next/no-img-element */
// O avatar vem de avatars.githubusercontent.com. Usar next/image aqui exigiria
// liberar o domínio remoto na config só para um ícone de 28px.

export function UserMenu({
  login,
  avatarUrl,
}: {
  login: string;
  avatarUrl: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-b border-black/10 px-8 py-2.5 dark:border-white/10">
      <img
        src={avatarUrl}
        alt=""
        width={28}
        height={28}
        className="rounded-full"
      />
      <span className="text-sm text-black/70 dark:text-white/70">{login}</span>

      {/* POST, não link: logout por GET é acionável por terceiros. */}
      <form action="/api/auth/logout" method="post">
        <button
          type="submit"
          className="rounded-md px-2.5 py-1 text-sm text-black/60 transition-colors hover:bg-black/[0.05] hover:text-black dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
        >
          Sair
        </button>
      </form>
    </div>
  );
}
