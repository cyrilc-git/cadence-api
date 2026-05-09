import { NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/linkedin';
import crypto from 'node:crypto';

export async function GET() {
  const state = crypto.randomBytes(16).toString('hex');
  const authUrl = buildAuthUrl(state);
  const r = NextResponse.redirect(authUrl);
  r.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/'
  });
  return r;
}
