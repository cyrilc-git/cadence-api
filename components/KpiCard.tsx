export default function KpiCard({ label, value, hint, accent }: { label: string; value: React.ReactNode; hint?: string; accent?: 'brand' | 'success' | 'warn' | 'danger' }) {
  const ring = accent === 'success' ? 'ring-success-500/20' : accent === 'warn' ? 'ring-warn-500/20' : accent === 'danger' ? 'ring-danger-500/20' : accent === 'brand' ? 'ring-brand-500/20' : 'ring-ink-300/30';
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ${ring}`}>
      <div className="text-xs uppercase tracking-wide text-ink-500 font-medium">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink-900">{value}</div>
      {hint && <div className="mt-1 text-sm text-ink-500">{hint}</div>}
    </div>
  );
}
