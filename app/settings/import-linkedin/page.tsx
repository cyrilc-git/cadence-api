import { redirect } from 'next/navigation';

// V12.10 §3 — la page "plan d'import à venir" (vocabulaire roadmap,
// références "V7.7", boutons disabled) a été remplacée par
// /sources/linkedin qui est un vrai écran d'import opérationnel.
// On redirige pour éviter qu'un signet ramène l'utilisateur sur la
// vieille page "à venir".
export const dynamic = 'force-static';

export default function ImportLinkedInRedirect() {
  redirect('/sources/linkedin');
}
