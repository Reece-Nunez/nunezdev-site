import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, email, signature } = await req.json();
  const hdrs = await headers();
  const ip = (hdrs.get('x-forwarded-for') || '').split(',')[0] || '0.0.0.0';

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from('invoices')
    .update({
      signer_name: name,
      signer_email: email,
      signer_ip: ip,
      signature_svg: signature,
      signed_at: new Date().toISOString()
    })
    .eq('id', id);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  return new Response(JSON.stringify({ ok: true }));
}
