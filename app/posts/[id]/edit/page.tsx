import EditClient from './client';
import { getNotionPost } from '@/lib/notion';
import { isValidated } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function EditPage({ params }: { params: { id: string } }) {
  const r = await getNotionPost(params.id);
  if (!r) return <div className="p-8 text-danger-700">Post introuvable.</div>;
  const validated = await isValidated(params.id).catch(() => false);
  return <EditClient initial={r} validated={validated} />;
}
