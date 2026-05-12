type Variant = 'success' | 'warn' | 'danger' | 'neutral' | 'brand';

const styles: Record<Variant, string> = {
  success: 'bg-success-50 text-success-700 ring-success-500/20',
  warn:    'bg-warn-50 text-warn-700 ring-warn-500/20',
  danger:  'bg-danger-50 text-danger-700 ring-danger-500/20',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-300/40',
  brand:   'bg-brand-50 text-brand-700 ring-brand-500/20'
};

export default function StatusBadge({ variant = 'neutral', children }: { variant?: Variant; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ring-1 ring-inset ${styles[variant]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${variant === 'success' ? 'bg-success-500' : variant === 'warn' ? 'bg-warn-500' : variant === 'danger' ? 'bg-danger-500' : variant === 'brand' ? 'bg-brand-500' : 'bg-ink-500'}`} />
      {children}
    </span>
  );
}
