import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getPortalSessionFromCookie } from '@/lib/portalAuth';
import { sendUploadNotification, createNotification } from '@/lib/notifications';
import { generatePresignedDownloadUrl } from '@/lib/s3';

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
      return NextResponse.json(
        { error: 'Your session expired right after the upload finished. Please sign in again — the file is in storage but not yet linked to the project.' },
        { status: 401 }
      );
    }

    const { uploadId, success } = await req.json();

    if (!uploadId) {
      return NextResponse.json(
        { error: `We couldn't confirm the upload because the request was missing the upload ID. Please refresh and try again.` },
        { status: 400 }
      );
    }

    // Verify upload belongs to this user and fetch details for notification
    const { data: upload, error: fetchError } = await supabase
      .from('client_uploads')
      .select(`
        id, s3_key, uploaded_by, file_name, file_size_bytes, mime_type,
        project:client_projects!project_id (
          id, name,
          client:clients!client_id ( name, org_id )
        )
      `)
      .eq('id', uploadId)
      .eq('uploaded_by', session.portalUserId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json(
        { error: `We couldn't find this upload record — it may have been removed, or it doesn't belong to your account.` },
        { status: 404 }
      );
    }

    const newStatus = success ? 'completed' : 'failed';

    // Update upload status (s3_key is already stored, we'll generate signed URLs on-demand)
    const { error: updateError } = await supabase
      .from('client_uploads')
      .update({
        upload_status: newStatus,
      })
      .eq('id', uploadId);

    if (updateError) {
      console.error('Error updating upload status:', updateError);
      return NextResponse.json(
        { error: `Your file uploaded to storage, but we couldn't save the record. Please try uploading it again — if it shows up twice, just delete the duplicate.` },
        { status: 500 }
      );
    }

    // Send email notification for successful uploads (fire and forget)
    if (success && upload.project) {
      const project = upload.project as any;
      sendUploadNotification({
        clientName: project.client?.name || 'Unknown Client',
        projectName: project.name || 'Unknown Project',
        fileName: upload.file_name,
        fileSizeMb: (upload.file_size_bytes / (1024 * 1024)).toFixed(2),
        fileType: upload.mime_type,
        projectId: project.id,
      }).catch(err => console.error('[upload-complete] Notification error:', err));

      // Create in-app notification
      const orgId = project.client?.org_id;
      if (orgId) {
        createNotification({
          orgId,
          type: 'file_uploaded',
          title: `${project.client?.name || 'Client'} uploaded a file`,
          body: `${upload.file_name} to ${project.name}`,
          link: `/dashboard/client-portal`,
        }).catch(err => console.error('[upload-complete] In-app notification error:', err));
      }
    }

    // Return the full upload record (including a fresh signed URL) so the
    // client can append it to the list without a full project refetch.
    let signedUrl: string | null = null;
    if (success && upload.s3_key) {
      try {
        signedUrl = await generatePresignedDownloadUrl(upload.s3_key, 3600);
      } catch (err) {
        console.error('[upload-complete] Could not generate download URL:', err);
      }
    }

    return NextResponse.json({
      success: true,
      uploadId,
      status: newStatus,
      upload: {
        id: upload.id,
        fileName: upload.file_name,
        fileSize: upload.file_size_bytes,
        mimeType: upload.mime_type,
        url: signedUrl,
        status: newStatus,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload completion error:', error);
    return NextResponse.json(
      { error: `Something went wrong on our end while finishing the upload. Please refresh and check if your file appears in the list before re-uploading.` },
      { status: 500 }
    );
  }
}
