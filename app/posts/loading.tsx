// V12.10 §5 — Squelette Bibliothèque pendant fetch des content_items.

export default function PostsLibraryLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="h-7 w-44 bg-ink-100 rounded" />
          <div className="mt-2 h-3 w-80 bg-ink-100 rounded max-w-full" />
        </div>
        <div className="h-9 w-32 bg-ink-100 rounded-lg" />
      </header>
      <div className="card p-3 flex gap-1.5 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-7 w-20 bg-ink-100 rounded-full" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-3 w-28 bg-ink-100 rounded" />
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-4 flex items-center gap-3">
              <div className="h-5 w-20 bg-ink-100 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="h-4 w-3/4 bg-ink-100 rounded" />
                <div className="h-3 w-1/3 bg-ink-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
