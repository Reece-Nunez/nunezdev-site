import { headers } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendBusinessNotification, createNotification } from '@/lib/notifications';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { name, email, signature } = await req.json();
  const hdrs = await headers();
  const ip = (hdrs.get('x-forwarded-for') || '').split(',')[0] || '0.0.0.0';

  const supabase = supabaseAdmin();
  
  // Get invoice details for notifications
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('invoice_number, client_id, org_id')
    .eq('id', id)
    .single();
  
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
  
  // Send contract signed notification
  if (invoice) {
    await sendBusinessNotification('contract_signed', {
      invoice_id: id,
      client_name: name,
      invoice_number: invoice.invoice_number
    });
    
    // Create in-app notification
    if (invoice.org_id) {
      createNotification({
        orgId: invoice.org_id,
        type: 'contract_signed',
        title: `Contract signed by ${name}`,
        body: `Invoice ${invoice.invoice_number}`,
        link: `/dashboard/invoices/${id}`,
      }).catch(err => console.error('[sign] In-app notification error:', err));
    }

    // Log activity
    await supabase
      .from('client_activity_log')
      .insert({
        invoice_id: id,
        client_id: invoice.client_id,
        activity_type: 'contract_signed',
        activity_data: {
          signer_name: name,
          signer_email: email,
          signed_at: new Date().toISOString()
        },
        user_agent: req.headers.get('user-agent'),
        ip_address: ip
      });
  }
  
  return new Response(JSON.stringify({ ok: true }));
}
