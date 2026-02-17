import { NextResponse } from 'next/server';
import { requireOwner } from '@/lib/authz';
import { supabaseServer } from '@/lib/supabaseServer';
import { deleteS3Object } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
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

    // Fetch the upload to get the S3 key and verify it belongs to this org
    const { data: upload, error: fetchError } = await supabase
      .from('client_uploads')
      .select(`
        id,
        s3_key,
        project_id,
        client_projects!inner(org_id)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    const orgId = (upload.client_projects as unknown as { org_id: string }).org_id;
    if (orgId !== guard.orgId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from S3
    try {
      await deleteS3Object(upload.s3_key);
    } catch (s3Error) {
      console.error('S3 delete error:', s3Error);
      // Continue to delete from DB even if S3 fails
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from('client_uploads')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting upload:', deleteError);
      return NextResponse.json({ error: 'Failed to delete upload' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/dashboard/client-uploads/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
