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
