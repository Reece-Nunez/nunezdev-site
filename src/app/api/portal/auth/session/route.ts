import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Check if user has password set
    const { data: user } = await supabase
      .from('client_portal_users')
      .select('password_hash')
      .eq('id', session.portalUserId)
      .single();

    return NextResponse.json({
      authenticated: true,
      portalUserId: session.portalUserId,
      clientId: session.clientId,
      email: session.email,
      clientName: session.clientName,
      hasPassword: !!user?.password_hash,
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
