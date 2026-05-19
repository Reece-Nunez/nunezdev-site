import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';
import { generatePresignedDownloadUrl, checkFileExists } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json(
        { error: 'Your session has expired. Please refresh the page and sign in again.' },
        { status: 401 }
      );
    }

    const { id: projectId } = await context.params;
    const body = await req.json().catch(() => ({}));
    const { name, description } = body as { name?: string; description?: string | null };

    // Allow updating only the fields the client should control.
    const updates: { name?: string; description?: string | null; s3_prefix?: string } = {};

    if (typeof name === 'string') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return NextResponse.json(
          { error: 'Project name can\'t be empty.' },
          { status: 400 }
        );
      }
      if (trimmedName.length > 120) {
        return NextResponse.json(
          { error: 'Project name is too long (max 120 characters).' },
          { status: 400 }
        );
      }
      updates.name = trimmedName;
      // Keep s3_prefix in sync with the new name for consistency. Note: this
      // only affects where *new* uploads land — already-uploaded S3 objects
      // stay in the original folder.
      const sanitizedName = trimmedName.replace(/[^a-zA-Z0-9 -]/g, '');
      const sanitizedClient = session.clientName.replace(/[^a-zA-Z0-9 -]/g, '');
      updates.s3_prefix = `${sanitizedName} - ${sanitizedClient}`;
    }

    if (description !== undefined) {
      updates.description = description === null ? null : String(description).trim() || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Nothing to update — provide a name or description.' },
        { status: 400 }
      );
    }

    const { data: updated, error } = await supabase
      .from('client_projects')
      .update(updates)
      .eq('id', projectId)
      .eq('client_id', session.clientId)
      .select('id, name, description, status, created_at')
      .single();

    if (error || !updated) {
      console.error('Error updating project:', error);
      return NextResponse.json(
        { error: 'We couldn\'t save the changes. The project may no longer belong to your account.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      project: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        createdAt: updated.created_at,
      },
    });
  } catch (error) {
    console.error('Project update error:', error);
    return NextResponse.json(
      { error: 'Something went wrong saving your changes. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await context.params;

    // Fetch project with uploads
    const { data: project, error: projectError } = await supabase
      .from('client_projects')
      .select(`
        id,
        name,
        description,
        status,
        created_at
      `)
      .eq('id', projectId)
      .eq('client_id', session.clientId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Fetch uploads for this project
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
      .eq('project_id', projectId)
      .eq('upload_status', 'completed')
      .order('created_at', { ascending: false });

    if (uploadsError) {
      console.error('Error fetching uploads:', uploadsError);
    }

    // Check which files still exist in S3 and generate signed URLs
    const uploadsWithUrls = (await Promise.all(
      (uploads || []).map(async (upload) => {
        const exists = await checkFileExists(upload.s3_key);

        // If file doesn't exist in S3, delete from database
        if (!exists) {
          await supabase
            .from('client_uploads')
            .delete()
            .eq('id', upload.id);
          return null;
        }

        return {
          id: upload.id,
          fileName: upload.file_name,
          fileSize: upload.file_size_bytes,
          mimeType: upload.mime_type,
          url: await generatePresignedDownloadUrl(upload.s3_key, 3600),
          status: upload.upload_status,
          createdAt: upload.created_at,
        };
      })
    )).filter(Boolean);

    return NextResponse.json({
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.created_at,
      },
      uploads: uploadsWithUrls,
    });
  } catch (error) {
    console.error('Project fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
