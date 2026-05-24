// V12.10 §5 — Squelette Mémoire pendant calcul computeBrainState.
// Sensiblement long (lit content_items, embeddings, infère sources).

export default function CerveauLoading() {
  return (
    <div className="space-y-12 max-w-3xl mx-auto animate-pulse">
      <header>
        <div className="h-3 w-20 bg-ink-100 rounded" />
        <div className="mt-2 h-8 w-64 bg-ink-100 rounded" />
        <div className="mt-3 h-3 w-3/4 bg-ink-100 rounded" />
      </header>
      <section className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-5 items-start">
        <div className="w-24 h-24 rounded-full bg-ink-100" />
        <div className="space-y-2 pt-1">
          <div className="h-3 w-36 bg-ink-100 rounded" />
          <div className="h-4 w-full bg-ink-100 rounded" />
          <div className="h-4 w-5/6 bg-ink-100 rounded" />
        </div>
      </section>
      <section>
        <div className="h-3 w-32 bg-ink-100 rounded mb-3" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-ink-100 p-3 space-y-2">
              <div className="h-2.5 w-16 bg-ink-100 rounded" />
              <div className="h-6 w-12 bg-ink-100 rounded" />
              <div className="h-2.5 w-20 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="h-3 w-44 bg-ink-100 rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5 border-b border-ink-100">
              <div className="h-1.5 w-1.5 rounded-full bg-ink-100" />
              <div className="h-3 w-2/3 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
