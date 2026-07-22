import { redirect } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { UserMenu } from "@/components/UserMenu";
import { getCurrentUser } from "@/lib/session";

/**
 * Tudo abaixo deste layout exige sessão.
 *
 * A checagem fica aqui, e não em middleware, porque a sessão é lida com
 * `cookies()` no runtime Node — middleware roda no edge e obrigaria a duplicar
 * a configuração de cifra em dois lugares.
 */
export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <UserMenu login={user.login} avatarUrl={user.avatarUrl} />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
