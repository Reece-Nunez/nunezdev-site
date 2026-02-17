import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseServer } from '@/lib/supabaseServer';
import { generatePresignedDownloadUrl, checkFileExists } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireOwner();
    if (!guard.ok) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const supabase = await supabaseServer();
    const { id } = await context.params;

    const { data: project, error } = await supabase
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
      .eq('id', id)
      .eq('org_id', guard.orgId)
      .single();

    if (error || !project) {
      console.error('Error fetching project:', error);
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from('client_uploads')
      .select(`
        id,
        file_name,
        file_size_bytes,
        mime_type,
        s3_key,
        upload_status,
        created_at
      `)
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (uploadsError) {
      console.error('Error fetching uploads:', uploadsError);
    }

    // Generate signed URLs for completed uploads
    const uploadsWithUrls = (await Promise.all(
      (uploads || []).map(async (u) => {
        if (u.upload_status !== 'completed') {
          return {
            id: u.id,
            fileName: u.file_name,
            fileSize: u.file_size_bytes,
            mimeType: u.mime_type,
            url: null,
            status: u.upload_status,
            createdAt: u.created_at,
          };
        }

        try {
          const exists = await checkFileExists(u.s3_key);

          if (!exists) {
            await supabase
              .from('client_uploads')
              .delete()
              .eq('id', u.id);
            return null;
          }

          return {
            id: u.id,
            fileName: u.file_name,
            fileSize: u.file_size_bytes,
            mimeType: u.mime_type,
            url: await generatePresignedDownloadUrl(u.s3_key, 3600, u.file_name),
            status: u.upload_status,
            createdAt: u.created_at,
          };
        } catch (s3Error) {
          console.error(`S3 error for file ${u.file_name}:`, s3Error);
          return {
            id: u.id,
            fileName: u.file_name,
            fileSize: u.file_size_bytes,
            mimeType: u.mime_type,
            url: null,
            status: u.upload_status,
            createdAt: u.created_at,
          };
        }
      })
    )).filter(Boolean);

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        s3Prefix: project.s3_prefix,
        status: project.status,
        createdAt: project.created_at,
        clientId: project.client_id,
        clientName: (project.clients as unknown as { name: string }).name,
      },
      uploads: uploadsWithUrls,
    });
  } catch (error) {
    console.error('Error in GET /api/dashboard/client-projects/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await supabaseServer();
  const { id } = await context.params;

  try {
    const { name, description, status } = await req.json();

    // Verify project exists and belongs to org
    const { data: existing, error: fetchError } = await supabase
      .from('client_projects')
      .select('id')
      .eq('id', id)
      .eq('org_id', guard.orgId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    const { data: project, error: updateError } = await supabase
      .from('client_projects')
      .update(updates)
      .eq('id', id)
      .select('id, name, description, status')
      .single();

    if (updateError) {
      console.error('Error updating project:', updateError);
      return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
    }

    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const guard = await requireOwner();
  if (!guard.ok) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const supabase = await supabaseServer();
  const { id } = await context.params;

  // Verify project exists and belongs to org
  const { data: existing, error: fetchError } = await supabase
    .from('client_projects')
    .select('id')
    .eq('id', id)
    .eq('org_id', guard.orgId)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from('client_projects')
    .delete()
    .eq('id', id);

  if (deleteError) {
    console.error('Error deleting project:', deleteError);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
