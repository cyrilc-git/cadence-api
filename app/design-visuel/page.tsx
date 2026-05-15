import { designSystemList } from '@/lib/db';
import DesignVisuelClient from './client';

export const dynamic = 'force-dynamic';

export default async function DesignVisuelPage() {
  const tokens = await designSystemList().catch(() => []);
  return <DesignVisuelClient initial={tokens} />;
}
