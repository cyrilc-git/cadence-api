const LINKEDIN_BASE = 'https://www.linkedin.com';
const LINKEDIN_API = 'https://api.linkedin.com';

export const SCOPES = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
    scope: SCOPES,
    state
  });
  return `${LINKEDIN_BASE}/oauth/v2/authorization?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: process.env.LINKEDIN_CLIENT_ID!,
    client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI!
  });
  const r = await fetch(`${LINKEDIN_BASE}/oauth/v2/accessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString()
  });
  if (!r.ok) throw new Error(`Token exchange failed: ${r.status} ${await r.text()}`);
  return r.json() as Promise<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    scope: string;
    token_type: string;
    id_token?: string;
  }>;
}

export async function getUserInfo(accessToken: string) {
  const r = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!r.ok) throw new Error(`userinfo failed: ${r.status}`);
  return r.json() as Promise<{ sub: string; name: string; email: string; picture?: string }>;
}

export async function publishUgcPost(accessToken: string, authorUrn: string, text: string) {
  const body = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE'
      }
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
  };
  const r = await fetch(`${LINKEDIN_API}/v2/ugcPosts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`ugcPosts failed: ${r.status} ${await r.text()}`);
  const postUrn = r.headers.get('x-restli-id') || (await r.json())?.id;
  return { postUrn };
}

// Fast token validation: hit /v2/userinfo, return sub if alive
export async function validateToken(accessToken: string): Promise<{ ok: true; sub: string; name: string; email: string } | { ok: false; status: number }> {
  try {
    const r = await fetch(`${LINKEDIN_API}/v2/userinfo`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!r.ok) return { ok: false, status: r.status };
    const data = await r.json();
    return { ok: true, sub: data.sub, name: data.name, email: data.email };
  } catch {
    return { ok: false, status: 0 };
  }
}
