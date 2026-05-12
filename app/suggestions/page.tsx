import SuggestionsClient from './client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Client fetches data itself to avoid any SSR cache and to allow live refresh after radar runs.
export default function SuggestionsPage() {
  return <SuggestionsClient />;
}
