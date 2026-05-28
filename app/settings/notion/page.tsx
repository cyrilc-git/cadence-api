import { redirect } from 'next/navigation';

// V51 §7 — Route morte. Cette page faisait doublon avec /sources/notion (même
// composant NotionSettingsClient). On garde /sources/notion comme surface
// unique et on redirige l'ancienne pour ne pas casser les signets.
export const dynamic = 'force-static';

export default function NotionSettingsRedirect() {
  redirect('/sources/notion');
}
