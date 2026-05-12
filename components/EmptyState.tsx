export default function EmptyState({ title, hint, cta }: { title: string; hint?: string; cta?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-ink-300 rounded-2xl px-8 py-12 text-center bg-white">
      <div className="mx-auto w-12 h-12 rounded-xl bg-ink-100 flex items-center justify-center text-ink-500 mb-4">
        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6 M12 9v6 M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"/>
        </svg>
      </div>
      <h3 className="text-base font-semibold text-ink-900">{title}</h3>
      {hint && <p className="mt-1 text-sm text-ink-500">{hint}</p>}
      {cta && <div className="mt-5">{cta}</div>}
    </div>
  );
}
