// V9.2 §2.2 — Badge provenance discret, premium, non intrusif.
// Usage : <ProvenanceBadge provenance={p} /> ou <ProvenanceBadge sourceType="linkedin_published" />.
// Règles :
// - "unknown" n'est PAS rendu en production (return null) sauf si forceShow=true (debug).
// - Pastille = 1 dot + 1 mot court. Pas de gradient, pas d'emoji.
// - Variante "dot" pour les cards très denses (calendrier mobile).

import { PROVENANCE_META, type Provenance, type SourceType } from '@/lib/provenance';

type Props = {
  provenance?: Provenance | null;
  sourceType?: SourceType;
  variant?: 'pill' | 'dot' | 'inline';
  size?: 'sm' | 'xs';
  forceShow?: boolean;        // Affiche unknown si true (debug)
  title?: string;             // Tooltip override
  className?: string;
};

export default function ProvenanceBadge({
  provenance,
  sourceType,
  variant = 'pill',
  size = 'xs',
  forceShow = false,
  title,
  className = '',
}: Props) {
  const type: SourceType = sourceType || provenance?.source_type || 'unknown';
  if (type === 'unknown' && !forceShow) return null;
  const meta = PROVENANCE_META[type];

  // Tooltip : label + microcopy confidence si dispo
  const tip = title || (provenance
    ? `${meta.label}${provenance.confidence === 'confirmed' ? ' · confirmé' : provenance.confidence === 'inferred' ? ' · déduit' : ''}`
    : meta.label);

  if (variant === 'dot') {
    return (
      <span
        className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dotClass} ${className}`}
        aria-label={meta.label}
        title={tip}
      />
    );
  }

  if (variant === 'inline') {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`} title={tip}>
        <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass} shrink-0`} aria-hidden />
        <span className={`text-2xs ${meta.textClass} font-medium uppercase tracking-wider`}>{meta.shortLabel || meta.label}</span>
      </span>
    );
  }

  // variant === 'pill' (par défaut)
  const padClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-2xs';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${padClass} ${meta.bgClass} ${meta.textClass} ${className}`}
      title={tip}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dotClass} shrink-0`} aria-hidden />
      <span className="truncate">{meta.shortLabel || meta.label}</span>
    </span>
  );
}
