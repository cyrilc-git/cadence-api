'use client';

// V9.0 §8 — Onboarding invisible contextuel.
// Détecte un manque dans l'état du compte (LinkedIn, Notion, posts, validations)
// et affiche UN seul banner calme avec 1 CTA. Dismiss via sessionStorage.
// Aucune checklist SaaS.

import { useEffect, useState } from 'react';
import Link from 'next/link';

export type OnboardingState = {
  linkedinConnected: boolean;
  notionOk: boolean;
  totalPosts: number;
  validated: number;
  needsValidation: number;
};

export default function OnboardingHint({ state }: { state: OnboardingState }) {
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    try { setDismissed(sessionStorage.getItem('cadence:onboarding-dismissed') || null); } catch {}
  }, []);

  // Compute the most relevant hint (1 only)
  const hint = pickHint(state);
  if (!hint || dismissed === hint.id) return null;

  function dismiss() {
    setDismissed(hint!.id);
    try { sessionStorage.setItem('cadence:onboarding-dismissed', hint!.id); } catch {}
  }

  return (
    <section className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-ink-50/50 border border-ink-100 animate-fade-in">
      <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${hint.tone}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-ink-800">{hint.message}</p>
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          {hint.cta_href && hint.cta_label && (
            <Link href={hint.cta_href} className="text-brand-700 hover:text-brand-900 font-medium transition">{hint.cta_label} →</Link>
          )}
          <button onClick={dismiss} className="text-ink-400 hover:text-ink-700 transition">plus tard</button>
        </div>
      </div>
    </section>
  );
}

function pickHint(s: OnboardingState): { id: string; message: string; tone: string; cta_href?: string; cta_label?: string } | null {
  // Priorité 1 : aucun post du tout → on est tout au début
  if (s.totalPosts === 0) {
    return {
      id: 'no-posts',
      message: 'Commençons par votre ligne éditoriale. Cadence saura quoi vous proposer ensuite.',
      tone: 'bg-brand-500',
      cta_href: '/brand-dna',
      cta_label: 'Définir la ligne'
    };
  }
  // Priorité 2 : LinkedIn pas connecté
  if (!s.linkedinConnected) {
    return {
      id: 'no-linkedin',
      message: 'Vos posts sont prêts. Connectez LinkedIn pour les publier en un clic.',
      tone: 'bg-amber-500',
      cta_href: '/sources',
      cta_label: 'Connecter LinkedIn'
    };
  }
  // Priorité 3 : Notion KO
  if (!s.notionOk) {
    return {
      id: 'no-notion',
      message: 'Notion ne répond pas. Sans lui, Cadence ne peut pas lire vos brouillons.',
      tone: 'bg-amber-500',
      cta_href: '/sources',
      cta_label: 'Vérifier Notion'
    };
  }
  // Priorité 4 : brouillons non validés
  if (s.needsValidation >= 3) {
    return {
      id: 'needs-validation',
      message: `${s.needsValidation} brouillons attendent une validation pour partir au cron.`,
      tone: 'bg-warn-500',
      cta_href: '/posts?status=needs_validation',
      cta_label: 'Valider'
    };
  }
  return null;
}
