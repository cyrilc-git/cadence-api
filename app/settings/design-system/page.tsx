import { redirect } from 'next/navigation';

// V12.10 — l'éditeur de tokens design-system a été remplacé par /design-visuel
// (vocabulaire produit "réglages" / "ambiance" / "références" au lieu de
// "tokens" / "categories" / "JSON keys"). On redirige toute requête vers
// la nouvelle surface pour éviter qu'un signet ou un lien direct ramène
// l'utilisateur sur l'ancien panneau technique.
export const dynamic = 'force-static';

export default function DesignSystemRedirect() {
  redirect('/design-visuel');
}
