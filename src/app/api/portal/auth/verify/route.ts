import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createPortalSession, setPortalSessionCookie } from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token || token.length < 32) {
      return NextResponse.redirect(new URL('/portal/login?error=invalid', req.url));
    }

    // Find portal user by token
    const { data: portalUser, error: userError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        client_id,
        email,
        token_expires_at,
        clients!inner(name)
      `)
      .eq('access_token', token)
      .eq('is_active', true)
      .single();

    if (userError || !portalUser) {
      return NextResponse.redirect(new URL('/portal/login?error=invalid', req.url));
    }

    // Check token expiry
    const expiresAt = new Date(portalUser.token_expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.redirect(new URL('/portal/login?error=expired', req.url));
    }

    // Invalidate token (single-use) and update last login
    const { error: updateError } = await supabase
      .from('client_portal_users')
      .update({
        access_token: null,
        token_expires_at: null,
        last_login_at: new Date().toISOString(),
      })
      .eq('id', portalUser.id);

    if (updateError) {
      console.error('Error invalidating token:', updateError);
    }

    // Create session
    const clientData = portalUser.clients as unknown as { name: string };
    const sessionToken = await createPortalSession({
      portalUserId: portalUser.id,
      clientId: portalUser.client_id,
      email: portalUser.email,
      clientName: clientData.name,
    });

    // Set session cookie
    await setPortalSessionCookie(sessionToken);

    // Redirect to portal dashboard
    return NextResponse.redirect(new URL('/portal/dashboard', req.url));
  } catch (error) {
    console.error('Token verification error:', error);
    return NextResponse.redirect(new URL('/portal/login?error=unknown', req.url));
  }
}
