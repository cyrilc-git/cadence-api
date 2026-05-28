import { redirect } from 'next/navigation';

// V51 §7 — Route morte. La « ligne éditoriale » n'est pas une surface des 3
// flux cœur et n'est plus dans la nav. L'identité éditoriale (votre style,
// vos mots) vit dans Mémoire (/cerveau). On redirige pour éviter une page
// orpheline accessible uniquement à l'URL.
export const dynamic = 'force-static';

export default function BrandDnaRedirect() {
  redirect('/cerveau');
}
