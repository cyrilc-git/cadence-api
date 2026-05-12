import BrandDnaClient from './client';
import { brandDnaList } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function BrandDnaPage() {
  let items: any[] = [];
  try { items = await brandDnaList(); } catch {}
  return <BrandDnaClient initial={items} />;
}
