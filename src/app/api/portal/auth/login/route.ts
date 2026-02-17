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
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
