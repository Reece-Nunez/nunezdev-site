import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireOwner } from '@/lib/authz';
import {
  resolveThumbtackConfig,
  exchangeAuthorizationCode,
  persistThumbtackTokens,
} from '@/lib/thumbtackApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// This route's URL is a Redirect URI registered with Thumbtack
// (https://www.nunezdev.com/api/thumbtack/callback). Do not move it without
// re-registering the new path.
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/thumbtack/callback`
  : 'http://localhost:3000/api/thumbtack/callback';

// GET /api/thumbtack/callback — Thumbtack redirects here with ?code & ?state
// after the owner approves. We validate state, exchange the code (with the PKCE
// verifier) for access + refresh tokens, and persist them for the owner's org.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const oauthError = url.searchParams.get('error');

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('thumbtack_oauth_state')?.value;
  const codeVerifier = cookieStore.get('thumbtack_oauth_verifier')?.value;
  // One-shot cookies — clear regardless of outcome.
  cookieStore.delete('thumbtack_oauth_state');
  cookieStore.delete('thumbtack_oauth_verifier');

  // Thumbtack signalled a denial / error on its side.
  if (oauthError) {
    return NextResponse.redirect(
      new URL(`/dashboard?thumbtack=error&reason=${encodeURIComponent(oauthError)}`, req.url)
    );
  }

  // CSRF: state must match the cookie; PKCE verifier must be present.
  if (!code || !state || !expectedState || state !== expectedState || !codeVerifier) {
    return NextResponse.redirect(
      new URL('/dashboard?thumbtack=error&reason=invalid_state', req.url)
    );
  }

  // Only the org owner may connect the business's Thumbtack account.
  const guard = await requireOwner();
  if (!guard.ok || !guard.orgId) {
    return NextResponse.redirect(new URL('/dashboard?thumbtack=forbidden', req.url));
  }
  const orgId = guard.orgId;

  const cfg = resolveThumbtackConfig();
  if (!cfg.clientId || !cfg.clientSecret) {
    return NextResponse.json(
      { error: 'Thumbtack OAuth not configured (set THUMBTACK_CLIENT_ID and THUMBTACK_CLIENT_SECRET)' },
      { status: 501 }
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode(cfg, {
      code,
      redirectUri: REDIRECT_URI,
      codeVerifier,
    });
    await persistThumbtackTokens(orgId, tokens);
  } catch {
    // Detail is logged server-side by the thrown error; keep the redirect opaque.
    return NextResponse.redirect(
      new URL('/dashboard?thumbtack=error&reason=token_exchange', req.url)
    );
  }

  return NextResponse.redirect(new URL('/dashboard?thumbtack=connected', req.url));
}
