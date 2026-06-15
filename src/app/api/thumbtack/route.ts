import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Issued by Thumbtack once the Partner Platform API access request is approved.
const THUMBTACK_CLIENT_ID = process.env.THUMBTACK_CLIENT_ID;

// Must match the Redirect URI submitted on the Thumbtack Partner form EXACTLY.
// Thumbtack rejects the handshake if this string differs by even a trailing slash.
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/thumbtack/callback`
  : 'http://localhost:3000/api/thumbtack/callback';

// TODO(post-approval): confirm these against Thumbtack's API docs. Placeholders
// until we have access — the authorize URL and scope names below are guesses.
const THUMBTACK_AUTHORIZE_URL = 'https://auth.thumbtack.com/oauth2/authorize';
const THUMBTACK_SCOPES = 'leads messages'; // space-separated; replace with real scope names

// GET /api/thumbtack — starts the OAuth handshake by redirecting the owner to
// Thumbtack's consent screen. The callback lands at /api/thumbtack/callback.
export async function GET() {
  if (!THUMBTACK_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Thumbtack OAuth not configured (set THUMBTACK_CLIENT_ID)' },
      { status: 501 }
    );
  }

  // CSRF state — verified against the cookie in the callback.
  const state = crypto.randomBytes(32).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set('thumbtack_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/',
  });

  const params = new URLSearchParams({
    client_id: THUMBTACK_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: THUMBTACK_SCOPES,
    state,
  });

  return NextResponse.redirect(`${THUMBTACK_AUTHORIZE_URL}?${params.toString()}`);
}
