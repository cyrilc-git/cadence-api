import { supabase } from './supabase';

export const BRAND_DNA_SEED = [
  // Piliers
  { kind: 'pilier', position: 1, label: 'Lundi · Cas dirigeant anonymisé' },
  { kind: 'pilier', position: 2, label: 'Mardi · Pédagogie sans jargon' },
  { kind: 'pilier', position: 3, label: 'Mercredi · Produit / démo / nouveauté / release note' },
  { kind: 'pilier', position: 4, label: 'Jeudi · Opinion / hot take mesuré' },
  { kind: 'pilier', position: 5, label: 'Vendredi · Build in public' },
  { kind: 'pilier', position: 6, label: 'Pas de publication le week-end par défaut' },

  // Audiences
  { kind: 'audience', label: 'Dirigeants PME/TPE (cible principale)' },
  { kind: 'audience', label: 'DAF internes (cible secondaire)' },
  { kind: 'audience', label: 'DAF externes / experts-comptables (ponctuel)' },

  // Règles de voix (à favoriser)
  { kind: 'rule', label: 'Vouvoiement systématique dans les posts' },
  { kind: 'rule', label: 'Ton humain, direct, concret, B2B premium' },
  { kind: 'rule', label: 'Phrases courtes, paragraphes aérés' },
  { kind: 'rule', label: 'Pas de jargon inutile — vocabulaire simple' },
  { kind: 'rule', label: 'Parler d’abord du problème utilisateur puis du bénéfice' },
  { kind: 'rule', label: 'Founder voice (Cyril, fondateur Heelio) — pas DAF freelance' },
  { kind: 'rule', label: 'Exemples chiffrés simples, cas anonymisés, bénéfices concrets' },
  { kind: 'rule', label: 'Démonstrations produit et nouveautés livrées' },
  { kind: 'rule', label: 'CTA sobre uniquement quand utile' },
  { kind: 'rule', label: '« Voici ce que ça change concrètement » comme angle terrain' },

  // Anti-patterns critiques
  { kind: 'anti_pattern', label: 'Aucun tiret long (— ou –)' },
  { kind: 'anti_pattern', label: '« Ce n’est pas X, c’est Y » et variantes' },
  { kind: 'anti_pattern', label: '« Non, X ne suffit pas »' },
  { kind: 'anti_pattern', label: '« La vérité, c’est que »' },
  { kind: 'anti_pattern', label: '« Spoiler »' },
  { kind: 'anti_pattern', label: '« Game changer »' },
  { kind: 'anti_pattern', label: '« Révolutionner »' },
  { kind: 'anti_pattern', label: '« Booster »' },
  { kind: 'anti_pattern', label: '« Libérer le potentiel »' },
  { kind: 'anti_pattern', label: '« Dans un monde où… »' },
  { kind: 'anti_pattern', label: 'Conclusion générique type « Et vous ? »' },
  { kind: 'anti_pattern', label: 'Style LinkedIn IA trop reconnaissable' },
  { kind: 'anti_pattern', label: 'Hashtags génériques inutiles (#leadership, #motivation)' },
  { kind: 'anti_pattern', label: 'Tutoiement' },
  { kind: 'anti_pattern', label: 'Claims exagérés' },
  { kind: 'anti_pattern', label: 'Confidentialité client risquée (nom, chiffres internes, situations identifiables)' },

  // Hashtags favoris
  { kind: 'hashtag', label: '#DAF' },
  { kind: 'hashtag', label: '#PME' },
  { kind: 'hashtag', label: '#treso' },
  { kind: 'hashtag', label: '#finance' },
  { kind: 'hashtag', label: '#dirigeant' },

  // Features Heelio prioritaires (sert le pilier Produit + Pédagogie)
  { kind: 'format', label: 'Feature Heelio : P&L estimé / vue économique sans attendre la compta' },
  { kind: 'format', label: 'Feature Heelio : FAE / FNP / lissage de charges / marge brute importée' },
  { kind: 'format', label: 'Feature Heelio : prévisionnel de trésorerie rapide depuis N-1' },
  { kind: 'format', label: 'Feature Heelio : catégorisation automatique des flux depuis les contreparties comptables' },
  { kind: 'format', label: 'Feature Heelio : onboarding plug and play' },
  { kind: 'format', label: 'Feature Heelio : suivi de trésorerie même sans compta' },
  { kind: 'format', label: 'Heelio Decode : analyse FEC / comptes annuels / diagnostic financier' }
];

export const INSPIRATIONS_SEED = [
  { slug: 'thomas-gasquez', name: 'Thomas Gasquez', url: 'https://www.linkedin.com/in/thomasgasquez/', category: 'Produit / Build in public', score: 5,
    style_notes: 'Inspiration pour les nouveautés produit, release notes LinkedIn, posts courts orientés produit. Structure « problème → nouveauté → bénéfice utilisateur ». Paragraphes ultra-aérés, première phrase punch.',
    do_not_copy: 'Ses formulations exactes, ses gimmicks personnels, ses signatures de hook, sa ponctuation décorative.' },
  { slug: 'maxime-blasco', name: 'Maxime Blasco', url: 'https://www.linkedin.com/in/maximeblasco/', category: 'Pédagogie SaaS', score: 5,
    style_notes: 'Inspiration pour la pédagogie claire, la vulgarisation, la structure fluide, la densité intéressante. Hook fort + 3 bullets + question concrète.',
    do_not_copy: 'Ses angles signature, ses cas clients spécifiques, ses formules récurrentes, ses templates répétitifs.' },
  { slug: 'louis-leblanc', name: 'Louis LeBlanc', url: 'https://www.linkedin.com/in/louisleblanc/', category: 'Opinion B2B finance', score: 4,
    style_notes: 'Inspiration pour posts d’opinion B2B sur la finance, clarté sur les problèmes dirigeants, hot takes mesurés, position claire dès la 1re phrase.',
    do_not_copy: 'Son style exact, ses formules type « voici pourquoi… », ses sujets niche.' },
  { slug: 'nicolas-adam', name: 'Nicolas Adam', url: 'https://www.linkedin.com/in/nicolasadam/', category: 'CTO / Produit / construction technique', score: 4,
    style_notes: 'Inspiration pour posts de coulisses, shipping, arbitrages techniques, construction produit. Authentique, sans posture.',
    do_not_copy: 'Ses formulations, ses anecdotes perso, ses noms de feature spécifiques, ses screenshots produit.' },
  { slug: 'remi-douchet', name: 'Rémi Douchet', url: 'https://www.linkedin.com/in/remidouchet/', category: 'Pédagogie / clarté business', score: 4,
    style_notes: 'Inspiration pour posts pédagogiques et structurés, angles utiles, clarté business, bénéfice utilisateur d’abord.',
    do_not_copy: 'Ses hooks signature, ses templates de structure, ses formats reconnaissables.' }
];

/**
 * Idempotent seed. Inserts missing rows, never overwrites existing user edits.
 * Returns counts.
 */
export async function seedBrandDna(): Promise<{ inserted: number; existing: number }> {
  let inserted = 0, existing = 0;
  for (const row of BRAND_DNA_SEED) {
    const { data: found } = await supabase.from('brand_dna').select('id').eq('kind', row.kind).eq('label', row.label).maybeSingle();
    if (found) { existing++; continue; }
    const { error } = await supabase.from('brand_dna').insert({ ...row, body: {}, active: true });
    if (!error) inserted++;
  }
  return { inserted, existing };
}

export async function seedInspirations(): Promise<{ inserted: number; existing: number }> {
  let inserted = 0, existing = 0;
  for (const row of INSPIRATIONS_SEED) {
    const { data: found } = await supabase.from('inspirations').select('id').eq('slug', row.slug).maybeSingle();
    if (found) { existing++; continue; }
    const { error } = await supabase.from('inspirations').insert({ ...row, active: true });
    if (!error) inserted++;
  }
  return { inserted, existing };
}
