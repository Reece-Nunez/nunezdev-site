import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createPortalSession, setPortalSessionCookie } from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/portal/auth/google/callback`
  : 'http://localhost:3000/api/portal/auth/google/callback';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=google_denied`);
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=invalid_request`);
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('google_oauth_state')?.value;
  cookieStore.delete('google_oauth_state');

  if (state !== storedState) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=invalid_state`);
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return NextResponse.redirect(`${baseUrl}/portal/login?error=not_configured`);
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenRes.ok) {
      console.error('Token exchange failed:', await tokenRes.text());
      return NextResponse.redirect(`${baseUrl}/portal/login?error=token_failed`);
    }

    const tokens = await tokenRes.json();

    // Get user info
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userInfoRes.ok) {
      return NextResponse.redirect(`${baseUrl}/portal/login?error=userinfo_failed`);
    }

    const googleUser = await userInfoRes.json();
    const email = googleUser.email?.toLowerCase();

    if (!email) {
      return NextResponse.redirect(`${baseUrl}/portal/login?error=no_email`);
    }

    // Find portal user by email - must match existing user
    const { data: portalUser, error: userError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        client_id,
        email,
        is_active,
        google_id,
        clients!inner(name)
      `)
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (userError || !portalUser) {
      // User's Google email doesn't match any portal user
      return NextResponse.redirect(`${baseUrl}/portal/login?error=not_registered`);
    }

    // Update google_id if not set
    if (!portalUser.google_id) {
      await supabase
        .from('client_portal_users')
        .update({
          google_id: googleUser.id,
          name: googleUser.name || null,
        })
        .eq('id', portalUser.id);
    }

    // Update last login
    await supabase
      .from('client_portal_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', portalUser.id);

    // Create session
    const clientName = (portalUser.clients as unknown as { name: string }).name;
    const sessionToken = await createPortalSession({
      portalUserId: portalUser.id,
      clientId: portalUser.client_id,
      email: portalUser.email,
      clientName,
    });

    await setPortalSessionCookie(sessionToken);

    return NextResponse.redirect(`${baseUrl}/portal/dashboard`);
  } catch (error) {
    console.error('Google OAuth error:', error);
    return NextResponse.redirect(`${baseUrl}/portal/login?error=server_error`);
  }
}
