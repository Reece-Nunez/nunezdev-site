import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseServer } from '@/lib/supabaseServer';

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
    .from('client_projects')
    .select(`
      id,
      name,
      description,
      s3_prefix,
      status,
      created_at,
      client_id,
      clients!inner(name)
    `)
    .eq('org_id', guard.orgId)
    .order('created_at', { ascending: false });

  if (clientId) {
    query = query.eq('client_id', clientId);
  }

  const { data: projects, error } = await query;

  if (error) {
    console.error('Error fetching client projects:', error);
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
  }

  return NextResponse.json({
    projects: (projects || []).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      s3Prefix: p.s3_prefix,
      status: p.status,
      createdAt: p.created_at,
      clientId: p.client_id,
      clientName: (p.clients as unknown as { name: string }).name,
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
    const { clientId, name, description } = await req.json();

    if (!clientId || !name) {
      return NextResponse.json(
        { error: 'clientId and name are required' },
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

    // Generate S3 prefix
    const s3Prefix = `${guard.orgId}/${clientId}`;

    // Create project
    const { data: project, error: createError } = await supabase
      .from('client_projects')
      .insert({
        org_id: guard.orgId,
        client_id: clientId,
        name,
        description: description || null,
        s3_prefix: s3Prefix,
        status: 'active',
      })
      .select('id, name, description, s3_prefix, status, created_at')
      .single();

    if (createError) {
      console.error('Error creating project:', createError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        s3Prefix: project.s3_prefix,
        status: project.status,
        createdAt: project.created_at,
        clientId,
        clientName: client.name,
      },
    });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
