import { NextResponse } from 'next/server';
import { getActiveToken } from '@/lib/supabase';
import { validateToken } from '@/lib/linkedin';

export async function GET() {
  const tokenRow = await getActiveToken().catch(() => null);
  if (!tokenRow) return NextResponse.json({ status: 'none' });
  const exp = new Date(tokenRow.expires_at).getTime();
  const v = await validateToken(tokenRow.access_token);
  if (!v.ok) return NextResponse.json({ status: 'expired', reason: `linkedin_api_${v.status}` });
  if (exp <= Date.now()) return NextResponse.json({ status: 'expired', reason: 'date_passed' });
  return NextResponse.json({
    status: 'connected',
    name: v.name,
    email: v.email,
    expires_at: tokenRow.expires_at,
    expires_in_days: Math.round((exp - Date.now()) / 86400000)
  });
}
