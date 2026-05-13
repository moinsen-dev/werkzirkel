/**
 * Macher:innen-Landingpage (Werkzirkel)
 * Wird in Sprint-1-Task #3 aus der statischen index.html nach Next.js portiert.
 * Aktuelle Version: minimaler Platzhalter, damit `pnpm build` grün läuft.
 */

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-xs font-semibold tracking-widest text-(--color-muted) uppercase">
        Werkstatt-Kultur · Hamburg zuerst
      </p>
      <h1 className="mt-4 font-(family-name:--font-display) text-5xl leading-tight font-bold tracking-tight md:text-6xl">
        Baue digitale Produkte nicht allein.
      </h1>
      <p className="mt-6 max-w-prose text-lg text-(--color-muted)">
        Werkzirkel verbindet unabhängige digitale Macher:innen in Hamburg — mit Bedarfsträger:innen
        und Förder:innen aus derselben Stadt. Werkstatt-Kultur, kein Marktplatz.
      </p>
      <p className="mt-8 text-sm text-(--color-muted)">
        Die vollständige Landingpage wird in Sprint 1 aus der statischen Version migriert.
      </p>
    </main>
  );
}
