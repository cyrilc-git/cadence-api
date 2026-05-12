import StatusBadge from '@/components/StatusBadge';

const INSPOS = [
  { name: 'Pierre Gasquez',     url: 'https://www.linkedin.com/in/pierregasquez/',     tag: 'Build in public',  note: 'Format storytelling court, paragraphes ultra-aérés' },
  { name: 'Camille Blasco',     url: 'https://www.linkedin.com/in/camille-blasco/',    tag: 'Pédagogie SaaS',   note: 'Hook fort + 3 bullets + question à la fin' },
  { name: 'Yann Leblanc',       url: 'https://www.linkedin.com/in/yannleblanc/',       tag: 'Opinion DAF',       note: 'Hot takes, ton direct, jamais de jargon' },
  { name: 'Charlotte Adam',     url: 'https://www.linkedin.com/in/charlotteadam/',     tag: 'Cas client',       note: 'Anonymise propre, raconte le déclic, chiffre la fin' },
  { name: 'Romain Douchet',     url: 'https://www.linkedin.com/in/romain-douchet/',    tag: 'Produit',          note: 'Présente une feature avec bénéfice utilisateur d\'abord' }
];

export default function InspirationsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold text-ink-900">Inspirations</h1>
        <p className="mt-1 text-ink-500">Comptes LinkedIn qui inspirent le format. Inspiration ≠ copie.</p>
      </header>

      <div className="bg-warn-50 ring-1 ring-inset ring-warn-500/20 rounded-2xl p-4 text-sm text-warn-700">
        <strong className="font-semibold">Règle stricte</strong> : aucune génération ne doit permettre de deviner la source. La regex anti-plagiat est appliquée côté serveur (l'IA ne reprend jamais une phrase reconnaissable).
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {INSPOS.map(i => (
          <div key={i.url} className="bg-white rounded-2xl p-5 shadow-card ring-1 ring-inset ring-ink-300/20">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-ink-900">{i.name}</div>
                <a href={i.url} target="_blank" rel="noopener" className="text-xs text-brand-700 hover:text-brand-600">Profil LinkedIn ↗</a>
              </div>
              <StatusBadge variant="neutral">{i.tag}</StatusBadge>
            </div>
            <p className="mt-3 text-sm text-ink-700">{i.note}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-ink-500">L'édition CRUD des inspirations sera ajoutée en V7.1 (DB Supabase dédiée + UI add/edit/delete).</p>
    </div>
  );
}
