import { redirect } from "next/navigation";

import type { AuthFailure } from "@/lib/auth/github-oauth";
import { getCurrentUser } from "@/lib/session";

const MESSAGES: Record<AuthFailure, string> = {
  access_denied: "You declined authorization on GitHub. Nothing was accessed.",
  invalid_state:
    "GitHub's return did not match the request that left here. For safety, the login was discarded. Try again.",
  exchange_failed:
    "GitHub did not confirm the authorization. Try again in a moment.",
  user_unavailable:
    "Authorization worked, but your GitHub profile could not be read.",
};

function errorMessage(error: string | undefined): string | null {
  if (!error) return null;
  return MESSAGES[error as AuthFailure] ?? MESSAGES.exchange_failed;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");

  const error = errorMessage((await searchParams).error);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <h1 className="font-mono text-2xl font-semibold tracking-tight">
        devidence<span className="text-black/40 dark:text-white/40">{" >_"}</span>
      </h1>
      <p className="mt-2 text-black/70 dark:text-white/70">
        Generates a PDF report about your contribution to a project, from
        verifiable GitHub activity.
      </p>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-md bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400"
        >
          {error}
        </p>
      )}

      <a
        href="/api/auth/login"
        className="mt-8 inline-flex items-center justify-center rounded-md bg-black px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 dark:bg-white dark:text-black"
      >
        Sign in with GitHub
      </a>

      <section className="mt-10 space-y-4 border-t border-black/10 pt-6 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        <h2 className="font-medium text-black/80 dark:text-white/80">
          What is requested, and why
        </h2>
        <p>
          GitHub will ask for permission to <strong>read your profile</strong>{" "}
          and <strong>access repositories</strong>. The repository access is
          broad because GitHub&apos;s OAuth offers no middle ground: it&apos;s
          either public repositories only, or full access. Since the real use is
          reporting on work done in a client&apos;s private repository, the app asks
          for full access.
        </p>
        <p>
          <strong>Your token is not stored anywhere.</strong> It lives only
          inside the encrypted session cookie, in your browser, and is used only
          during requests you start yourself. There is no token database, no sync
          running in the background. When you sign out, the token goes with it.
        </p>
        <p>
          You can revoke access at any time under{" "}
          <a
            className="underline underline-offset-2"
            href="https://github.com/settings/applications"
            target="_blank"
            rel="noreferrer"
          >
            Applications
          </a>{" "}
          in your GitHub settings.
        </p>
      </section>
    </main>
  );
}
