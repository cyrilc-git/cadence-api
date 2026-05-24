// V12.10 §5 — Squelette Calendrier pendant fetch des content_items.

export default function CalendarLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="h-7 w-40 bg-ink-100 rounded" />
          <div className="mt-2 h-3 w-72 bg-ink-100 rounded max-w-full" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-ink-100 rounded-lg" />
          <div className="h-9 w-24 bg-ink-100 rounded-lg" />
        </div>
      </header>
      <div className="grid grid-cols-7 gap-px bg-ink-100 rounded-2xl overflow-hidden">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-white p-2 min-h-[96px]">
            <div className="h-3 w-5 bg-ink-100 rounded" />
            <div className="mt-2 space-y-1">
              <div className="h-3 w-full bg-ink-100 rounded" />
              <div className="h-3 w-3/4 bg-ink-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
