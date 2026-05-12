import BrandDnaClient from './client';
import { brandDnaList } from '@/lib/db';
import { getWeeklyPlan } from '@/lib/weekly';

export const dynamic = 'force-dynamic';

export default async function BrandDnaPage() {
  let items: any[] = [];
  let plan: any[] = [];
  try { items = await brandDnaList(); } catch {}
  try { plan = await getWeeklyPlan(); } catch {}
  return <BrandDnaClient initial={items} initialPlan={plan} />;
}
