import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateMagicLinkToken, getTokenExpiry } from '@/lib/portalAuth';
import { sendPortalMagicLink } from '@/lib/portalEmail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find portal user by email
    const { data: portalUser, error: userError } = await supabase
      .from('client_portal_users')
      .select(`
        id,
        client_id,
        is_active,
        clients!inner(name, email)
      `)
      .eq('email', normalizedEmail)
      .eq('is_active', true)
      .single();

    if (userError || !portalUser) {
      // Don't reveal if email exists or not
      return NextResponse.json({
        message: 'If an account exists with this email, you will receive a magic link shortly.',
      });
    }

    // Generate magic link token
    const token = generateMagicLinkToken();
    const expiresAt = getTokenExpiry();

    // Update portal user with new token
    const { error: updateError } = await supabase
      .from('client_portal_users')
      .update({
        access_token: token,
        token_expires_at: expiresAt.toISOString(),
      })
      .eq('id', portalUser.id);

    if (updateError) {
      console.error('Error updating portal user token:', updateError);
      return NextResponse.json({ error: 'Failed to generate magic link' }, { status: 500 });
    }

    // Build magic link URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const magicLinkUrl = `${baseUrl}/portal/verify/${token}`;

    // Send email
    const clientData = portalUser.clients as unknown as { name: string; email: string };
    await sendPortalMagicLink({
      to: normalizedEmail,
      clientName: clientData.name,
      magicLinkUrl,
    });

    return NextResponse.json({
      message: 'If an account exists with this email, you will receive a magic link shortly.',
    });
  } catch (error) {
    console.error('Magic link request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
