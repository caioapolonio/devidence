import { LlmCredentialsForm } from "@/components/LlmCredentialsForm";
import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="The report is generated with your own API key, so the cost is yours and you choose the model."
      />

      <LlmCredentialsForm />

      <section className="mt-10 max-w-2xl space-y-3 border-t border-black/10 pt-6 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
        <h2 className="font-medium text-black/80 dark:text-white/80">
          What happens to your key
        </h2>
        <p>
          It lives <strong>only</strong> inside the encrypted session cookie, in
          your browser, the same treatment given to the GitHub token. There is no
          credential database in this project. When you sign out, or click remove,
          the key goes with it.
        </p>
        <p>
          Before saving, the app makes a minimal call to the chosen model to
          confirm it returns structured output. Without that there is no way to
          guarantee that every claim in the report is tied to a piece of evidence,
          and a report that looks right but isn&apos;t would be worse than none.
        </p>
      </section>
    </>
  );
}
