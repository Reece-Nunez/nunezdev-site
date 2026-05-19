import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';
import { generatePresignedDownloadUrl, checkFileExists, copyS3Object, deleteS3Object } from '@/lib/s3';

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
    let newS3Prefix: string | null = null;

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
      const sanitizedName = trimmedName.replace(/[^a-zA-Z0-9 -]/g, '');
      const sanitizedClient = session.clientName.replace(/[^a-zA-Z0-9 -]/g, '');
      newS3Prefix = `${sanitizedName} - ${sanitizedClient}`;
      updates.s3_prefix = newS3Prefix;
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

    // Snapshot the project (incl. current s3_prefix) BEFORE the update so we
    // know what prefix existing S3 keys live under.
    const { data: current } = await supabase
      .from('client_projects')
      .select('id, s3_prefix, name')
      .eq('id', projectId)
      .eq('client_id', session.clientId)
      .single();

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

    // If the name (and therefore the S3 prefix) actually changed, move all
    // existing S3 objects into the new folder so storage stays tidy.
    //
    // Per-file order matters for safety:
    //   1. Copy old → new (file exists at both locations)
    //   2. Update DB s3_key (lookup now points to new location)
    //   3. Delete old (cleanup; if this fails, only an orphan remains)
    //
    // If interrupted between any steps the file is still reachable from
    // either path.
    let movedCount = 0;
    let moveFailures = 0;
    if (current?.s3_prefix && newS3Prefix && current.s3_prefix !== newS3Prefix) {
      const { data: uploads } = await supabase
        .from('client_uploads')
        .select('id, s3_key')
        .eq('project_id', projectId);

      const oldPrefix = `${current.s3_prefix}/`;
      for (const upload of uploads || []) {
        if (!upload.s3_key?.startsWith(oldPrefix)) continue; // skip non-conforming keys
        const newKey = `${newS3Prefix}/${upload.s3_key.slice(oldPrefix.length)}`;

        const copied = await copyS3Object(upload.s3_key, newKey);
        if (!copied) {
          moveFailures++;
          continue;
        }

        const { error: dbErr } = await supabase
          .from('client_uploads')
          .update({ s3_key: newKey })
          .eq('id', upload.id);

        if (dbErr) {
          console.error('[project-rename] DB s3_key update failed', { uploadId: upload.id, dbErr });
          moveFailures++;
          // Leave the copy in place; old key still works via the DB record.
          continue;
        }

        // Best-effort cleanup of the original. If this fails the file is just
        // orphaned at the old key — not user-facing.
        try {
          await deleteS3Object(upload.s3_key);
        } catch (delErr) {
          console.warn('[project-rename] delete of old key failed', { oldKey: upload.s3_key, delErr });
        }
        movedCount++;
      }
    }

    return NextResponse.json({
      project: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        createdAt: updated.created_at,
      },
      movedFiles: movedCount,
      moveFailures,
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
