import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, getUserInfo } from '@/lib/linkedin';
import { saveToken } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) {
    return NextResponse.redirect(new URL(`/?li_error=${encodeURIComponent(error)}`, req.url));
  }
  if (!code) return NextResponse.redirect(new URL('/?li_error=missing_code', req.url));

  const cookieState = req.cookies.get('oauth_state')?.value;
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(new URL('/?li_error=state_mismatch', req.url));
  }

  try {
    const tokens = await exchangeCode(code);
    const user = await getUserInfo(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    await saveToken({
      linkedin_user_id: user.sub,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope
    });
    return NextResponse.redirect(new URL('/?connected=1', req.url));
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/?li_error=${encodeURIComponent(e.message)}`, req.url));
  }
}
