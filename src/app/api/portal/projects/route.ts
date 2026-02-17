import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';

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

    const { name, description } = await req.json();

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Project name is required' }, { status: 400 });
    }

    // Get client's org_id
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('org_id, name')
      .eq('id', session.clientId)
      .single();

    if (clientError || !client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // Create the project
    const sanitizedName = name.trim();
    const s3Prefix = `${sanitizedName.replace(/[^a-zA-Z0-9 -]/g, '')} - ${client.name.replace(/[^a-zA-Z0-9 -]/g, '')}`;

    const { data: project, error: createError } = await supabase
      .from('client_projects')
      .insert({
        org_id: client.org_id,
        client_id: session.clientId,
        name: sanitizedName,
        description: description?.trim() || null,
        s3_prefix: s3Prefix,
        status: 'active',
      })
      .select('id, name, description, status, created_at')
      .single();

    if (createError) {
      console.error('Error creating project:', createError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.created_at,
        uploadCount: 0,
      },
    });
  } catch (error) {
    console.error('Project creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch projects for this client
    const { data: projects, error } = await supabase
      .from('client_projects')
      .select(`
        id,
        name,
        description,
        status,
        created_at,
        client_uploads(count)
      `)
      .eq('client_id', session.clientId)
      .eq('status', 'active')
      .eq('client_uploads.upload_status', 'completed')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching projects:', error);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Transform to include upload count
    const projectsWithCounts = projects.map((project) => {
      let uploadCount = 0;
      if (Array.isArray(project.client_uploads) && project.client_uploads.length > 0) {
        uploadCount = (project.client_uploads[0] as { count: number }).count || 0;
      } else if (project.client_uploads && !Array.isArray(project.client_uploads)) {
        uploadCount = (project.client_uploads as { count: number }).count || 0;
      }
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.created_at,
        uploadCount,
      };
    });

    return NextResponse.json({ projects: projectsWithCounts });
  } catch (error) {
    console.error('Projects fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
