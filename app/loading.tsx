// V12.10 §5 — Squelette dashboard pendant fetch initial.
// Évite l'écran blanc puis le jump quand Notion + LinkedIn + Supabase
// répondent (peut prendre 600-1500ms à froid). On reproduit la
// structure exacte (header + week strip + insight) pour zéro CLS.

export default function DashboardLoading() {
  return (
    <div className="space-y-10 max-w-3xl mx-auto animate-pulse">
      <header>
        <div className="h-3 w-32 bg-ink-100 rounded" />
        <div className="mt-2 h-7 w-48 bg-ink-100 rounded" />
      </header>
      <div className="border-l-2 border-ink-100 pl-4 space-y-2">
        <div className="h-3 w-24 bg-ink-100 rounded" />
        <div className="h-5 w-3/4 bg-ink-100 rounded" />
        <div className="h-3 w-1/2 bg-ink-100 rounded" />
      </div>
      <section>
        <div className="h-3 w-40 bg-ink-100 rounded mb-3" />
        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="rounded-xl p-2 border border-ink-100 h-[72px]">
              <div className="h-2.5 w-8 bg-ink-100 rounded" />
              <div className="mt-1.5 h-5 w-5 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </section>
      <div className="pt-2 border-t border-ink-100">
        <div className="h-3 w-2/3 bg-ink-100 rounded" />
      </div>
    </div>
  );
}
