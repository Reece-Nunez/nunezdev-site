import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseServer } from '@/lib/supabaseServer';
import { getS3Object, checkFileExists } from '@/lib/s3';
import archiver from 'archiver';
import { PassThrough, Readable } from 'stream';

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

    // Get project info
    const { data: project, error: projectError } = await supabase
      .from('client_projects')
      .select('id, name, client_id, clients!inner(name)')
      .eq('id', id)
      .eq('org_id', guard.orgId)
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Get completed uploads
    const { data: uploads, error: uploadsError } = await supabase
      .from('client_uploads')
      .select('id, file_name, s3_key, upload_status')
      .eq('project_id', id)
      .eq('upload_status', 'completed');

    if (uploadsError || !uploads || uploads.length === 0) {
      return NextResponse.json({ error: 'No files to download' }, { status: 404 });
    }

    // Filter to only files that exist in S3
    const existingUploads = [];
    for (const upload of uploads) {
      const exists = await checkFileExists(upload.s3_key);
      if (exists) {
        existingUploads.push(upload);
      }
    }

    if (existingUploads.length === 0) {
      return NextResponse.json({ error: 'No files found in storage' }, { status: 404 });
    }

    // Create zip archive
    const archive = archiver('zip', { zlib: { level: 5 } });
    const passthrough = new PassThrough();

    archive.pipe(passthrough);

    // Add each file to the archive
    for (const upload of existingUploads) {
      try {
        const s3Response = await getS3Object(upload.s3_key);
        if (s3Response.Body) {
          const bodyStream = s3Response.Body as Readable;
          archive.append(bodyStream, { name: upload.file_name });
        }
      } catch (err) {
        console.error(`Failed to fetch ${upload.file_name} from S3:`, err);
      }
    }

    archive.finalize();

    const clientName = (project.clients as unknown as { name: string }).name;
    const zipFileName = `${project.name} - ${clientName}.zip`;

    // Convert passthrough stream to a web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        passthrough.on('data', (chunk) => controller.enqueue(chunk));
        passthrough.on('end', () => controller.close());
        passthrough.on('error', (err) => controller.error(err));
      },
    });

    return new Response(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFileName}"`,
      },
    });
  } catch (error) {
    console.error('Error in download zip:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
