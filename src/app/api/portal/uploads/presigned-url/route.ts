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
  'image/heic',
  'image/heif',
  'application/pdf',
];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.heic', '.heif', '.pdf'];

function isFileAllowed(fileName: string, fileType: string): boolean {
  if (ALLOWED_TYPES.includes(fileType)) return true;
  const name = (fileName || '').toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function POST(req: Request) {
  try {
    const session = await getPortalSessionFromCookie();

    if (!session) {
      return NextResponse.json(
        { error: 'Your session has expired. Please refresh the page and sign in again.' },
        { status: 401 }
      );
    }

    const { projectId, fileName, fileType, fileSize } = await req.json();

    if (!projectId || !fileName || !fileSize) {
      return NextResponse.json(
        { error: `We couldn't read the file's details. Please refresh and try selecting the file again.` },
        { status: 400 }
      );
    }

    const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `"${fileName}" is ${mb(fileSize)} — over our 100 MB limit. Please compress or resize the file and try again.`,
        },
        { status: 400 }
      );
    }

    // Validate file type (with extension fallback for iOS HEIC/empty mime types)
    if (!isFileAllowed(fileName, fileType || '')) {
      const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]?.replace('.', '').toUpperCase() || 'unknown';
      return NextResponse.json(
        {
          error: `"${fileName}" is a ${ext} file, which isn't supported. Allowed: JPEG, PNG, GIF, WebP, SVG, HEIC, or PDF.`,
        },
        { status: 400 }
      );
    }

    // Normalize content type when client didn't provide one (common on iOS HEIC)
    const ext = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0];
    const extToMime: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.heic': 'image/heic',
      '.heif': 'image/heif',
      '.pdf': 'application/pdf',
    };
    const resolvedContentType = fileType || (ext && extToMime[ext]) || 'application/octet-stream';

    // Verify project belongs to this client and get project name
    const { data: project, error: projectError } = await supabase
      .from('client_projects')
      .select('id, org_id, client_id, name, status')
      .eq('id', projectId)
      .eq('client_id', session.clientId)
      .eq('status', 'active')
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'This project is no longer active or doesn\'t belong to your account. Refresh the page or pick a different project.' },
        { status: 404 }
      );
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
        mime_type: resolvedContentType,
        s3_key: s3Key,
        upload_status: 'pending',
      })
      .select('id')
      .single();

    if (uploadError) {
      console.error('Error creating upload record:', uploadError);
      return NextResponse.json(
        { error: `We couldn't record the upload in our database. Please try again — if this keeps happening, let us know.` },
        { status: 500 }
      );
    }

    // Generate pre-signed URL
    const presignedUrl = await generatePresignedUploadUrl({
      key: s3Key,
      contentType: resolvedContentType,
      expiresIn: 3600, // 1 hour
    });

    return NextResponse.json({
      uploadId: upload.id,
      presignedUrl,
      s3Key,
      contentType: resolvedContentType,
    });
  } catch (error) {
    console.error('Pre-signed URL generation error:', error);
    return NextResponse.json(
      { error: `Something went wrong on our end while preparing the upload. Please try again in a moment.` },
      { status: 500 }
    );
  }
}
