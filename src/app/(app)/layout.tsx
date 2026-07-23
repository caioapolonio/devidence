import { redirect } from "next/navigation";

import { Sidebar } from "@/components/Sidebar";
import { UserMenu } from "@/components/UserMenu";
import { getCurrentUser } from "@/lib/session";

/**
 * Everything below this layout requires a session.
 *
 * The check lives here, not in middleware, because the session is read with
 * `cookies()` on the Node runtime. Middleware runs on the edge and would force
 * the cipher configuration to be duplicated in two places.
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
