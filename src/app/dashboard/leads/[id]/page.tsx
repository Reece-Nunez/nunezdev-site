import { notFound, redirect } from 'next/navigation';
import { requireOwner } from '@/lib/authz';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import LeadDetailContent from './LeadDetailContent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const guard = await requireOwner();
  if (!guard.ok) redirect(`/login?next=/dashboard/leads/${id}`);

  const supabase = supabaseAdmin();
  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !lead) notFound();

  return <LeadDetailContent lead={lead} />;
}
