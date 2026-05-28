import { redirect } from 'next/navigation';

// V51 §7 — Route morte. L'analytics autonome (KPI grid, « fiabilité des
// chiffres ») ne fait pas partie des 3 flux cœur et n'est plus dans la nav.
// Les enseignements éditoriaux vivent dans Mémoire (/cerveau). On redirige
// pour ne pas laisser une surface « dashboard » orpheline accessible à l'URL.
export const dynamic = 'force-static';

export default function AnalyticsRedirect() {
  redirect('/cerveau');
}
