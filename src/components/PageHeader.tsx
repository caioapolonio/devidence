export function PageHeader({
  title,
  subtitle,
  pending,
}: {
  title: string;
  subtitle: string;
  /** Etapa que ainda vai preencher esta tela. */
  pending?: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 max-w-2xl text-sm text-black/60 dark:text-white/60">{subtitle}</p>
      {pending && (
        <p className="mt-4 rounded-md border border-dashed border-black/15 px-3 py-2 text-sm text-black/50 dark:border-white/15 dark:text-white/50">
          {pending}
        </p>
      )}
    </header>
  );
}
