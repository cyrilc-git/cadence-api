import SuggestionsClient from './client';
import { suggestionsList } from '@/lib/db';
import { runAllRadars } from '@/lib/radar';

export const dynamic = 'force-dynamic';

export default async function SuggestionsPage() {
  let suggestions: any[] = [];
  try {
    suggestions = await suggestionsList('pending', 50);
    // If empty, seed once
    if (suggestions.length === 0) {
      await runAllRadars().catch(() => {});
      suggestions = await suggestionsList('pending', 50);
    }
  } catch {}
  return <SuggestionsClient initial={suggestions} />;
}
