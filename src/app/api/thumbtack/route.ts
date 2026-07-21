import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';
import { resolveThumbtackConfig, buildAuthorizeUrl } from '@/lib/thumbtackApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Must match a Redirect URI registered with Thumbtack EXACTLY (prod:
// https://www.nunezdev.com/api/thumbtack/callback). Thumbtack rejects the
// handshake if this differs by even a trailing slash.
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/thumbtack/callback`
  : 'http://localhost:3000/api/thumbtack/callback';

const base64url = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// GET /api/thumbtack — starts the OAuth2 authorization_code handshake by
// redirecting the owner to Thumbtack's consent screen. The supply-side Partner
// API requires this user-consent flow (client_credentials is rejected for our
// client), so the owner grants access once and the callback stores the tokens.
export async function GET() {
  const cfg = resolveThumbtackConfig();
  if (!cfg.clientId) {
    return NextResponse.json(
      { error: 'Thumbtack OAuth not configured (set THUMBTACK_CLIENT_ID)' },
      { status: 501 }
    );
  }

  // CSRF state + PKCE verifier — both verified in the callback.
  const state = base64url(crypto.randomBytes(32));
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash('sha256').update(codeVerifier).digest());

  const cookieStore = await cookies();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 10, // 10 minutes to complete consent
    path: '/',
  };
  cookieStore.set('thumbtack_oauth_state', state, cookieOpts);
  cookieStore.set('thumbtack_oauth_verifier', codeVerifier, cookieOpts);

  return NextResponse.redirect(
    buildAuthorizeUrl(cfg, { redirectUri: REDIRECT_URI, state, codeChallenge })
  );
}
