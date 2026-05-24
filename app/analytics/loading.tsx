// V12.10 §5 — Squelette Analytics pendant computeHumanInsights.

export default function AnalyticsLoading() {
  return (
    <div className="space-y-10 max-w-3xl mx-auto animate-pulse">
      <header>
        <div className="h-3 w-20 bg-ink-100 rounded" />
        <div className="mt-2 h-8 w-44 bg-ink-100 rounded" />
        <div className="mt-3 h-3 w-3/4 bg-ink-100 rounded" />
      </header>
      <section>
        <div className="h-3 w-36 bg-ink-100 rounded mb-3" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-ink-100 p-3 space-y-2">
              <div className="h-2.5 w-20 bg-ink-100 rounded" />
              <div className="h-6 w-12 bg-ink-100 rounded" />
              <div className="h-2.5 w-24 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <div className="h-3 w-40 bg-ink-100 rounded mb-3" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-ink-100 mt-2" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-full bg-ink-100 rounded" />
                <div className="h-3 w-3/4 bg-ink-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
