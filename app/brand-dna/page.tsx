import { PILIERS, VOIX, ANTI_PATTERNS } from '@/lib/brand-config';
import StatusBadge from '@/components/StatusBadge';

export default function BrandDnaPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Brand DNA</h1>
        <p className="mt-1 text-ink-500">La voix Cadence : ce qu'on dit, ce qu'on ne dit jamais.</p>
      </header>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">5 piliers éditoriaux</h2>
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {PILIERS.map(p => (
            <div key={p.key} className="rounded-xl ring-1 ring-ink-300/30 p-4">
              <div className="text-xs uppercase tracking-wide text-ink-500">{p.day}</div>
              <div className="font-semibold text-ink-900 mt-1">{p.key.split('· ')[1]}</div>
              {p.anonymisation && <div className="mt-2"><StatusBadge variant="warn">Anonymisation requise</StatusBadge></div>}
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Voix</h2>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-700">
          <li>• Vouvoiement systématique dans les posts</li>
          <li>• Founder voice (Cyril, fondateur Heelio) — pas DAF freelance</li>
          <li>• Tonalité : {VOIX.tonalité.join(', ')}</li>
          <li>• Longueur cible : {VOIX.longueur_cible.min}-{VOIX.longueur_cible.max} caractères (optimal 600-900)</li>
        </ul>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-card ring-1 ring-inset ring-ink-300/20">
        <h2 className="font-semibold text-ink-900">Patterns interdits (garde-fous IA)</h2>
        <ul className="mt-3 space-y-2">
          {ANTI_PATTERNS.map(ap => (
            <li key={ap.id} className="text-sm flex items-start gap-3">
              <StatusBadge variant={ap.severity === 'critical' ? 'danger' : ap.severity === 'high' ? 'warn' : 'neutral'}>
                {ap.severity}
              </StatusBadge>
              <span className="text-ink-700">{ap.label}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
