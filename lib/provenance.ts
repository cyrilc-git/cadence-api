// V9.2 §2 — Couche provenance pure : aucun appel DB, aucune écriture.
// Calcule à la volée la "vraie" source d'un post pour distinguer ce qui est certifié
// publié sur LinkedIn de ce qui est seulement présent dans Notion ou inféré.
//
// Règle produit clé : un post Notion marqué publié SANS URL LinkedIn n'est PAS un
// "Publié LinkedIn" — il devient "Archive Notion" (inferred). LinkedIn reste seul
// juge de ce qui a réellement été publié.

export type SourceType =
  | 'linkedin_published'    // Publication confirmée sur LinkedIn (URL/URN connue)
  | 'linkedin_import_zip'   // Import ZIP/CSV LinkedIn (archive officielle)
  | 'notion_draft'          // Brouillon ou planifié dans Notion (pas encore publié)
  | 'notion_archive'        // Notion dit "publié" mais sans URL LinkedIn vérifiable
  | 'cadence_generated'     // Créé par Cadence (assistant éditorial)
  | 'unknown';              // Aucun signal fiable

export type ConfidenceLevel = 'confirmed' | 'inferred' | 'unknown';

export type Provenance = {
  source_type: SourceType;
  confidence: ConfidenceLevel;
  source_id: string;                    // id Notion, source_ref pgvector, ou hash fallback
  canonical_url?: string | null;        // URL LinkedIn si dispo, sinon URL Notion
  notion_page_id?: string | null;
  linkedin_urn?: string | null;
  linkedin_url?: string | null;
  published_at?: string | null;
  scheduled_at?: string | null;
  validation_status?: 'validated' | 'pending' | null;
  sync_status?: 'synced' | 'pending' | 'not_synced' | null;
  last_synced_at?: string | null;
};

// === Inputs acceptés (subsets typés des objets existants) ===
export type NotionPostInput = {
  id: string;
  title?: string;
  status?: 'draft' | 'scheduled' | 'published' | 'error';
  linkedin_url?: string | null;
  notion_url?: string | null;
  scheduled_at?: string | null;
  validated?: boolean;
  cadence_source?: string | null;       // 'cadence' | 'linkedin_archive' | null
};

export type EmbeddingPostInput = {
  id?: string;
  source?: string;                      // 'notion' | 'linkedin_archive' | 'inspiration' | 'manual'
  source_ref?: string;
  status?: string | null;
  scheduled_at?: string | null;
  meta?: any;
};

// === Helper : extraire l'URN d'une URL LinkedIn quand possible ===
export function extractLinkedinUrn(url: string | null | undefined): string | null {
  if (!url) return null;
  // Formats : urn:li:activity:1234... ou /feed/update/urn%3Ali%3Aactivity%3A1234.../
  const decoded = decodeURIComponent(url);
  const m = decoded.match(/urn:li:(activity|ugcPost|share):(\d+)/);
  if (m) return `urn:li:${m[1]}:${m[2]}`;
  const m2 = decoded.match(/activity[-_:](\d+)/i);
  if (m2) return `urn:li:activity:${m2[1]}`;
  return null;
}

// === Inférence depuis un post Notion ===
export function inferFromNotion(post: NotionPostInput): Provenance {
  const linkedinUrl = post.linkedin_url || null;
  const hasLinkedInLink = !!linkedinUrl && /linkedin\.com/i.test(linkedinUrl);
  const urn = extractLinkedinUrn(linkedinUrl);

  // 1. Créé par Cadence
  if (post.cadence_source === 'cadence') {
    // Confirmed si on a déjà un lien LinkedIn (donc publié), sinon inferred
    return {
      source_type: 'cadence_generated',
      confidence: hasLinkedInLink ? 'confirmed' : 'inferred',
      source_id: post.id,
      canonical_url: linkedinUrl || post.notion_url || null,
      notion_page_id: post.id,
      linkedin_url: linkedinUrl,
      linkedin_urn: urn,
      scheduled_at: post.scheduled_at || null,
      published_at: post.status === 'published' ? post.scheduled_at || null : null,
      validation_status: post.validated ? 'validated' : 'pending',
      sync_status: hasLinkedInLink ? 'synced' : 'pending',
    };
  }

  // 2. Import LinkedIn archive (ZIP/CSV)
  if (post.cadence_source === 'linkedin_archive') {
    return {
      source_type: 'linkedin_import_zip',
      confidence: 'confirmed',
      source_id: post.id,
      canonical_url: linkedinUrl || post.notion_url || null,
      notion_page_id: post.id,
      linkedin_url: linkedinUrl,
      linkedin_urn: urn,
      published_at: post.scheduled_at || null,
      sync_status: 'synced',
    };
  }

  // 3. Publié confirmé LinkedIn (URL présente + status published)
  if (post.status === 'published' && hasLinkedInLink) {
    return {
      source_type: 'linkedin_published',
      confidence: 'confirmed',
      source_id: post.id,
      canonical_url: linkedinUrl,
      notion_page_id: post.id,
      linkedin_url: linkedinUrl,
      linkedin_urn: urn,
      published_at: post.scheduled_at || null,
      sync_status: 'synced',
    };
  }

  // 4. Brouillon ou programmé Notion
  if (post.status === 'draft' || post.status === 'scheduled') {
    return {
      source_type: 'notion_draft',
      confidence: 'inferred',
      source_id: post.id,
      canonical_url: post.notion_url || null,
      notion_page_id: post.id,
      scheduled_at: post.scheduled_at || null,
      validation_status: post.validated ? 'validated' : 'pending',
      sync_status: 'not_synced',
    };
  }

  // 5. Notion dit "publié" mais sans URL LinkedIn : archive Notion
  if (post.status === 'published') {
    return {
      source_type: 'notion_archive',
      confidence: 'inferred',
      source_id: post.id,
      canonical_url: post.notion_url || null,
      notion_page_id: post.id,
      published_at: post.scheduled_at || null,
      sync_status: 'not_synced',
    };
  }

  // 6. Fallback
  return {
    source_type: 'unknown',
    confidence: 'unknown',
    source_id: post.id,
    canonical_url: post.notion_url || null,
    notion_page_id: post.id,
  };
}

// === Inférence depuis une ligne post_embeddings ===
export function inferFromEmbedding(row: EmbeddingPostInput): Provenance {
  const id = row.id || row.source_ref || 'unknown';
  const linkedinUrl: string | null = (row.meta && (row.meta.linkedin_url || row.meta.url)) || null;
  const urn = extractLinkedinUrn(linkedinUrl);

  if (row.source === 'linkedin_archive') {
    return {
      source_type: 'linkedin_import_zip',
      confidence: 'confirmed',
      source_id: id,
      canonical_url: linkedinUrl,
      linkedin_url: linkedinUrl,
      linkedin_urn: urn,
      published_at: row.scheduled_at || null,
      sync_status: 'synced',
    };
  }

  if (row.source === 'notion') {
    // On retombe sur la logique notion mais on n'a pas linkedin_url ici la plupart du temps
    if (row.status === 'published' && linkedinUrl) {
      return {
        source_type: 'linkedin_published',
        confidence: 'confirmed',
        source_id: id,
        canonical_url: linkedinUrl,
        notion_page_id: row.source_ref || null,
        linkedin_url: linkedinUrl,
        linkedin_urn: urn,
        published_at: row.scheduled_at || null,
        sync_status: 'synced',
      };
    }
    if (row.status === 'published') {
      return {
        source_type: 'notion_archive',
        confidence: 'inferred',
        source_id: id,
        notion_page_id: row.source_ref || null,
        published_at: row.scheduled_at || null,
        sync_status: 'not_synced',
      };
    }
    return {
      source_type: 'notion_draft',
      confidence: 'inferred',
      source_id: id,
      notion_page_id: row.source_ref || null,
      scheduled_at: row.scheduled_at || null,
      sync_status: 'not_synced',
    };
  }

  if (row.source === 'inspiration') {
    return {
      source_type: 'unknown',
      confidence: 'unknown',
      source_id: id,
    };
  }

  return {
    source_type: 'unknown',
    confidence: 'unknown',
    source_id: id,
  };
}

// === Façade : détecte le type d'input et délègue ===
export function inferProvenance(input: NotionPostInput | EmbeddingPostInput): Provenance {
  // NotionPostInput a un `id` non optionnel + `notion_url` ou `linkedin_url` ou `cadence_source`
  // EmbeddingPostInput a un `source` (sentinel)
  if ('source' in input && typeof (input as EmbeddingPostInput).source === 'string') {
    return inferFromEmbedding(input as EmbeddingPostInput);
  }
  return inferFromNotion(input as NotionPostInput);
}

// === Métadonnées d'affichage (utilisées par ProvenanceBadge et /cerveau) ===
export type ProvenanceMeta = {
  label: string;        // Texte du badge
  shortLabel: string;   // Version courte (mobile/cards denses)
  tone: 'linkedin' | 'notion' | 'archive' | 'cadence' | 'neutral';
  // Couleurs Tailwind : on garde la palette existante (brand, ink, success, amber)
  // pour ne pas introduire un nouveau set chromatique.
  dotClass: string;
  textClass: string;
  bgClass: string;
};

export const PROVENANCE_META: Record<SourceType, ProvenanceMeta> = {
  linkedin_published: {
    label: 'Publié LinkedIn',
    shortLabel: 'LinkedIn',
    tone: 'linkedin',
    dotClass: 'bg-[#0A66C2]',
    textClass: 'text-[#0A66C2]',
    bgClass: 'bg-[#0A66C2]/10',
  },
  linkedin_import_zip: {
    label: 'Import LinkedIn',
    shortLabel: 'Import LI',
    tone: 'linkedin',
    dotClass: 'bg-[#0A66C2]/70',
    textClass: 'text-[#0A66C2]',
    bgClass: 'bg-[#0A66C2]/5',
  },
  notion_draft: {
    label: 'Brouillon Notion',
    shortLabel: 'Notion',
    tone: 'notion',
    dotClass: 'bg-ink-500',
    textClass: 'text-ink-700',
    bgClass: 'bg-ink-100',
  },
  notion_archive: {
    label: 'Archive Notion',
    shortLabel: 'Archive',
    tone: 'archive',
    dotClass: 'bg-amber-500',
    textClass: 'text-amber-700',
    bgClass: 'bg-amber-50',
  },
  cadence_generated: {
    label: 'Cadence',
    shortLabel: 'Cadence',
    tone: 'cadence',
    dotClass: 'bg-brand-500',
    textClass: 'text-brand-700',
    bgClass: 'bg-brand-50',
  },
  unknown: {
    label: 'Source inconnue',
    shortLabel: '',
    tone: 'neutral',
    dotClass: 'bg-ink-300',
    textClass: 'text-ink-500',
    bgClass: 'bg-ink-50',
  },
};

// === Aide produit : confidence -> microcopy ===
export function confidenceMicrocopy(c: ConfidenceLevel): string {
  switch (c) {
    case 'confirmed': return 'Confirmé via LinkedIn';
    case 'inferred':  return 'Déduit depuis Notion';
    case 'unknown':   return 'Source non identifiée';
  }
}

// === Assertions de logique (exécutées au runtime en dev pour valider les règles clés) ===
// Aucune exécution en prod (process.env.NODE_ENV check). Tests unitaires light.
export function __runProvenanceAssertions(): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const expect = (cond: boolean, msg: string) => { if (!cond) failures.push(msg); };

  // Cas 1 : Notion publié avec URL LinkedIn -> linkedin_published / confirmed
  const p1 = inferFromNotion({ id: 'n1', status: 'published', linkedin_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1234/' });
  expect(p1.source_type === 'linkedin_published', 'C1: linkedin_published attendu');
  expect(p1.confidence === 'confirmed', 'C1: confirmed attendu');
  expect(p1.linkedin_urn === 'urn:li:activity:1234', 'C1: URN extraction');

  // Cas 2 : Notion publié SANS URL LinkedIn -> notion_archive / inferred
  const p2 = inferFromNotion({ id: 'n2', status: 'published' });
  expect(p2.source_type === 'notion_archive', 'C2: notion_archive attendu');
  expect(p2.confidence === 'inferred', 'C2: inferred attendu');

  // Cas 3 : Notion draft -> notion_draft / inferred
  const p3 = inferFromNotion({ id: 'n3', status: 'draft' });
  expect(p3.source_type === 'notion_draft', 'C3: notion_draft attendu');

  // Cas 4 : cadence_source=cadence -> cadence_generated
  const p4 = inferFromNotion({ id: 'n4', status: 'draft', cadence_source: 'cadence' });
  expect(p4.source_type === 'cadence_generated', 'C4: cadence_generated attendu');

  // Cas 5 : cadence_source=linkedin_archive -> linkedin_import_zip / confirmed
  const p5 = inferFromNotion({ id: 'n5', status: 'published', cadence_source: 'linkedin_archive' });
  expect(p5.source_type === 'linkedin_import_zip', 'C5: linkedin_import_zip attendu');
  expect(p5.confidence === 'confirmed', 'C5: confirmed attendu');

  // Cas 6 : embedding linkedin_archive -> linkedin_import_zip
  const p6 = inferFromEmbedding({ source: 'linkedin_archive', source_ref: 'lia-42' });
  expect(p6.source_type === 'linkedin_import_zip', 'C6: linkedin_import_zip attendu');

  // Cas 7 : aucune info -> unknown
  const p7 = inferFromNotion({ id: 'n7' });
  expect(p7.source_type === 'unknown', 'C7: unknown attendu');

  return { ok: failures.length === 0, failures };
}
