import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';
import { generatePresignedUploadUrl, buildS3Key } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
];

export async function POST(req: Request) {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId, fileName, fileType, fileSize } = await req.json();

    if (!projectId || !fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, fileName, fileType, fileSize' },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: 'File type not allowed. Allowed types: JPEG, PNG, GIF, WebP, SVG, PDF' },
        { status: 400 }
      );
    }

    // Verify project belongs to this client and get project name
    const { data: project, error: projectError } = await supabase
      .from('client_projects')
      .select('id, org_id, client_id, name, status')
      .eq('id', projectId)
      .eq('client_id', session.clientId)
      .eq('status', 'active')
      .single();

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found or inactive' }, { status: 404 });
    }

    // Build S3 key with readable folder name: "ProjectName - ClientName/filename"
    const s3Key = buildS3Key(session.clientName, project.name, fileName);

    // Create upload record with pending status
    const { data: upload, error: uploadError } = await supabase
      .from('client_uploads')
      .insert({
        project_id: projectId,
        uploaded_by: session.portalUserId,
        file_name: fileName,
        file_size_bytes: fileSize,
        mime_type: fileType,
        s3_key: s3Key,
        upload_status: 'pending',
      })
      .select('id')
      .single();

    if (uploadError) {
      console.error('Error creating upload record:', uploadError);
      return NextResponse.json({ error: 'Failed to initiate upload' }, { status: 500 });
    }

    // Generate pre-signed URL
    const presignedUrl = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: fileType,
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({
      uploadId: upload.id,
      presignedUrl,
      s3Key,
    });
  } catch (error) {
    console.error('Pre-signed URL generation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
