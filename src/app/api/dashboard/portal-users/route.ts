import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseServer } from '@/lib/supabaseServer';
import { sendPortalMagicLink } from '@/lib/portalEmail';
import { generateMagicLinkToken, getTokenExpiry } from '@/lib/portalAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await supabaseServer();
  const url = new URL(req.url);
  const clientId = url.searchParams.get('clientId');

  let query = supabase
    .from('client_portal_users')
    .select(`
      id,
      email,
      is_active,
      last_login_at,
      created_at,
      client_id,
      clients!inner(name, org_id)
    `)
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: users, error } = await query;

  if (error) {
    console.error('Error fetching portal users:', error);
    return NextResponse.json({ error: 'Failed to fetch portal users' }, { status: 500 });
  }

  // Filter by org
  const filteredUsers = users?.filter((u) => {
    const client = u.clients as unknown as { name: string; org_id: string };
    return client.org_id === guard.orgId;
  }) || [];

  return NextResponse.json({
    users: filteredUsers.map((u) => ({
      id: u.id,
      email: u.email,
      isActive: u.is_active,
      lastLoginAt: u.last_login_at,
      createdAt: u.created_at,
      clientId: u.client_id,
      clientName: (u.clients as unknown as { name: string }).name,
    })),
  });
}

export async function POST(req: Request) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await supabaseServer();

  try {
    const { clientId, email, sendInvite } = await req.json();

    if (!clientId || !email) {
      return NextResponse.json(
        { error: 'clientId and email are required' },
        { status: 400 }
      );
    }

    // Verify client belongs to this org
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, org_id')
      .eq('id', clientId)
      .eq('org_id', guard.orgId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Create portal user
    const { data: portalUser, error: createError } = await supabase
      .from('client_portal_users')
      .insert({
        client_id: clientId,
        email: email.toLowerCase().trim(),
        is_active: true,
      })
      .select('id, email')
      .single();

    if (createError) {
      if (createError.code === '23505') {
        return NextResponse.json(
          { error: 'A portal user with this email already exists for this client' },
          { status: 409 }
        );
      }
      console.error('Error creating portal user:', createError);
      return NextResponse.json({ error: 'Failed to create portal user' }, { status: 500 });
    }

    // Send invite if requested
    if (sendInvite) {
      const token = generateMagicLinkToken();
      const expiresAt = getTokenExpiry();

      await supabase
        .from('client_portal_users')
        .update({
          access_token: token,
          token_expires_at: expiresAt.toISOString(),
        })
        .eq('id', portalUser.id);

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
      const magicLinkUrl = `${baseUrl}/portal/verify/${token}`;

      await sendPortalMagicLink({
        to: portalUser.email,
        clientName: client.name,
        magicLinkUrl,
      });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: portalUser.id,
        email: portalUser.email,
        clientId,
        clientName: client.name,
      },
      inviteSent: sendInvite,
    });
  } catch (error) {
    console.error('Error creating portal user:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
