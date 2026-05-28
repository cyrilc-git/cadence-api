import { redirect } from 'next/navigation';

// V51 §7 — Route morte. Le panneau « Paramètres » (connecteurs, credentials,
// clé maître) faisait doublon avec le hub Sources. On redirige vers /sources,
// devenu le point unique de connexion / statut / déblocage.
export const dynamic = 'force-static';

export default function SettingsRedirect() {
  redirect('/sources');
}
