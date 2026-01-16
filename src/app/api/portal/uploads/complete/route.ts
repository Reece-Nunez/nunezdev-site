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

    const { uploadId, success } = await req.json();

    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId is required' }, { status: 400 });
    }

    // Verify upload belongs to this user
    const { data: upload, error: fetchError } = await supabase
      .from('client_uploads')
      .select('id, s3_key, uploaded_by')
      .eq('id', uploadId)
      .eq('uploaded_by', session.portalUserId)
      .single();

    if (fetchError || !upload) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
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
      return NextResponse.json({ error: 'Failed to update upload status' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      uploadId,
      status: newStatus,
    });
  } catch (error) {
    console.error('Upload completion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
