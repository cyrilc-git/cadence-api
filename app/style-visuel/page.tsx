import { designSystemList } from '@/lib/db';
import StyleVisuelClient from './client';

export const dynamic = 'force-dynamic';

export default async function StyleVisuelPage() {
  const tokens = await designSystemList().catch(() => []);
  return <StyleVisuelClient initial={tokens} />;
}
