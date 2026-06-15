import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getPortalSessionFromCookie,
  hashPassword,
  createPortalSession,
  setPortalSessionCookie,
} from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { password } = await req.json();

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    // Bump session_version so every previously issued session token (other
    // browsers/devices) is invalidated on the next request. The session that
    // came from the cookie already matched the current version, so the new
    // version is simply +1.
    const newSessionVersion = (session.sessionVersion ?? 0) + 1;

    const { error: updateError } = await supabase
      .from('client_portal_users')
      .update({ password_hash: passwordHash, session_version: newSessionVersion })
      .eq('id', session.portalUserId);

    if (updateError) {
      console.error('Error setting password:', updateError);
      return NextResponse.json(
        { error: 'Failed to set password' },
        { status: 500 }
      );
    }

    // Re-issue this device's cookie with the new version so the user who just
    // changed the password stays logged in here while other devices are kicked.
    const refreshedToken = await createPortalSession({ ...session, sessionVersion: newSessionVersion });
    await setPortalSessionCookie(refreshedToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Set password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
