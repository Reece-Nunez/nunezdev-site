import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createPortalSession,
  setPortalSessionCookie,
  verifyPassword,
} from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Brute-force protection: lock the account after this many consecutive failed
// password attempts, for this many minutes.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Find portal user by email
    const { data: portalUser, error: userError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        client_id,
        email,
        password_hash,
        is_active,
        session_version,
        failed_login_attempts,
        locked_until,
        clients!inner(name)
      `)
      .eq('email', email.toLowerCase().trim())
      .eq('is_active', true)
      .single();

    if (userError || !portalUser) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Brute-force lockout: reject while the account is in a lock window.
    if (portalUser.locked_until && new Date(portalUser.locked_until) > new Date()) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Please try again in a few minutes.' },
        { status: 429 }
      );
    }

    // Check if user has a password set
    if (!portalUser.password_hash) {
      return NextResponse.json(
        { error: 'Password not set. Please use the magic link or set a password first.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, portalUser.password_hash);
    if (!isValid) {
      // Count the failure and lock the account once the threshold is reached.
      const attempts = (portalUser.failed_login_attempts ?? 0) + 1;
      const updates: { failed_login_attempts: number; locked_until?: string } = {
        failed_login_attempts: attempts,
      };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        updates.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
        updates.failed_login_attempts = 0; // reset counter; the lock now gates access
      }
      await supabase
        .from('client_portal_users')
        .update(updates)
        .eq('id', portalUser.id);

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Success: clear any failure state and update last login.
    await supabase
      .from('client_portal_users')
      .update({
        last_login_at: new Date().toISOString(),
        failed_login_attempts: 0,
        locked_until: null,
      })
      .eq('id', portalUser.id);

    // Create session
    const clientName = (portalUser.clients as unknown as { name: string }).name;
    const sessionToken = await createPortalSession({
      portalUserId: portalUser.id,
      clientId: portalUser.client_id,
      email: portalUser.email,
      clientName,
      sessionVersion: (portalUser.session_version as number) ?? 0,
    });

    await setPortalSessionCookie(sessionToken);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
