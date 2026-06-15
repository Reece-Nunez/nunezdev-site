import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireOwner } from '@/lib/authz';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This route's URL is the Redirect URI submitted on the Thumbtack Partner form:
//   https://www.nunezdev.com/api/thumbtack/callback
// Do not move it without re-submitting the new path to Thumbtack.

const THUMBTACK_CLIENT_ID = process.env.THUMBTACK_CLIENT_ID;
const THUMBTACK_CLIENT_SECRET = process.env.THUMBTACK_CLIENT_SECRET;

const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/thumbtack/callback`
  : 'http://localhost:3000/api/thumbtack/callback';

// TODO(post-approval): confirm token endpoint + request shape against Thumbtack docs.
const THUMBTACK_TOKEN_URL = 'https://auth.thumbtack.com/oauth2/token';

// GET /api/thumbtack/callback — Thumbtack redirects here with ?code & ?state
// after the owner approves access. We validate state, exchange the code for
// tokens, and (once a storage table exists) persist them for the org.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  // Thumbtack signalled a denial / error on its side.
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/dashboard?thumbtack=error&reason=${encodeURIComponent(oauthError)}`, req.url)
    );
  }

  // CSRF: the state must match the cookie set when the flow started.
  const cookieStore = await cookies();
  const expectedState = cookieStore.get('thumbtack_oauth_state')?.value;
  cookieStore.delete('thumbtack_oauth_state');

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(
      new URL('/dashboard?thumbtack=error&reason=invalid_state', req.url)
    );
  }

  // Only the org owner may connect the business's Thumbtack account.
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.redirect(new URL('/dashboard?thumbtack=forbidden', req.url));
  }

  if (!THUMBTACK_CLIENT_ID || !THUMBTACK_CLIENT_SECRET) {
    return NextResponse.json(
      {
        error:
          'Thumbtack OAuth not configured (set THUMBTACK_CLIENT_ID and THUMBTACK_CLIENT_SECRET)',
      },
      { status: 501 }
    );
  }

  // Exchange the authorization code for access/refresh tokens.
  // TODO(post-approval): confirm whether Thumbtack wants client creds in the
  // body (as below) or via HTTP Basic auth, and the exact field names returned.
  const tokenRes = await fetch(THUMBTACK_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: THUMBTACK_CLIENT_ID,
      client_secret: THUMBTACK_CLIENT_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL('/dashboard?thumbtack=error&reason=token_exchange', req.url)
    );
  }

  // const tokens = await tokenRes.json();
  // TODO(post-approval): persist tokens for guard.orgId once an integration
  // credentials table exists (e.g. thumbtack_access_token, refresh_token,
  // expires_at, scope). Encrypt at rest — these grant access to lead/billing data.

  return NextResponse.redirect(new URL('/dashboard?thumbtack=connected', req.url));
}
