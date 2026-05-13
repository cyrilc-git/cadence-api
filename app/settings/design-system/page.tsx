import DesignSystemClient from './client';
import { designSystemList } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function DesignSystemPage() {
  const tokens = await designSystemList().catch(() => []);
  return <DesignSystemClient initial={tokens} />;
}
