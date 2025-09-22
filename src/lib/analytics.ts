import { supabaseServer } from "@/lib/supabaseServer";

export interface MetricDetail {
  id: string;
  type: 'payment' | 'invoice' | 'deal';
  label: string;
  amount: number;
  date: string;
  status?: string;
  description?: string;
}

export interface AnalyticsData {
  revenueThisMonth: number;
  totalRevenue: number;
  outstandingBalance: number;
  pipelineValue: number;
  clientsCount: number;
  // Detailed breakdowns for popups
  thisMonthPayments: MetricDetail[];
  allPayments: MetricDetail[];
  outstandingInvoices: MetricDetail[];
  openDeals: MetricDetail[];
}

export async function getAnalytics(orgId: string): Promise<AnalyticsData> {
  const supabase = await supabaseServer();
  console.log('[analytics] Starting analytics query for orgId:', orgId);

  // Get current month start
  const thisMonthStart = new Date();
  thisMonthStart.setDate(1);
  thisMonthStart.setHours(0, 0, 0, 0);
  console.log('[analytics] This month start:', thisMonthStart.toISOString());

  // Get all payments this month with details
  const { data: thisMonthPayments, error: thisMonthError } = await supabase
    .from("invoice_payments")
    .select(`
      id,
      amount_cents,
      paid_at,
      payment_method,
      invoices!inner(
        id,
        invoice_number,
        org_id,
        clients!inner(name)
      )
    `)
    .eq("invoices.org_id", orgId)
    .gte("paid_at", thisMonthStart.toISOString())
    .order("paid_at", { ascending: false });

  console.log('[analytics] This month payments:', thisMonthPayments?.length || 0, 'error:', thisMonthError);

  // Get all payments ever with details
  const { data: allPayments } = await supabase
    .from("invoice_payments")
    .select(`
      id,
      amount_cents,
      paid_at,
      payment_method,
      invoices!inner(
        id,
        invoice_number,
        org_id,
        clients!inner(name)
      )
    `)
    .eq("invoices.org_id", orgId)
    .order("paid_at", { ascending: false });

  // Get outstanding invoices with remaining balances
  const { data: outstandingInvoices } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      amount_cents,
      status,
      due_at,
      clients!inner(name),
      invoice_payments(amount_cents)
    `)
    .eq("org_id", orgId)
    .in("status", ["sent", "overdue"])
    .order("due_at", { ascending: true });

  // Get open deals
  const { data: openDeals } = await supabase
    .from("deals")
    .select(`
      id,
      title,
      value_cents,
      stage,
      created_at,
      clients!inner(name)
    `)
    .eq("org_id", orgId)
    .not("stage", "in", '("Won","Lost","Abandoned")')
    .order("value_cents", { ascending: false });

  // Get client count
  const { count: clientsCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Calculate metrics
  const revenueThisMonth = (thisMonthPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const totalRevenue = (allPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const pipelineValue = (openDeals ?? []).reduce((sum, d) => sum + (d.value_cents ?? 0), 0);

  // Calculate outstanding balance (invoice amount minus payments)
  const outstandingBalance = (outstandingInvoices ?? []).reduce((sum, inv) => {
    const totalPaid = (inv.invoice_payments ?? []).reduce((pSum, p) => pSum + (p.amount_cents ?? 0), 0);
    const remaining = Math.max(0, (inv.amount_cents ?? 0) - totalPaid);
    return sum + remaining;
  }, 0);

  // Format data for popups
  const formatPayments = (payments: any[]): MetricDetail[] => {
    console.log('[analytics] Formatting payments:', payments?.length || 0);
    const formatted = (payments ?? []).map(p => ({
      id: p.id,
      type: 'payment' as const,
      label: `${(p.invoices as any)?.clients?.name || 'Unknown'} - ${(p.invoices as any)?.invoice_number || 'INV'}`,
      amount: p.amount_cents,
      date: p.paid_at,
      description: `Payment via ${p.payment_method || 'card'}`
    }));
    console.log('[analytics] Formatted payments result:', formatted);
    return formatted;
  };

  const formatInvoices = (invoices: any[]): MetricDetail[] =>
    (invoices ?? []).map(inv => {
      const totalPaid = (inv.invoice_payments ?? []).reduce((sum: number, p: any) => sum + (p.amount_cents ?? 0), 0);
      const remaining = Math.max(0, (inv.amount_cents ?? 0) - totalPaid);
      return {
        id: inv.id,
        type: 'invoice' as const,
        label: `${(inv.clients as any)?.name || 'Unknown'} - ${inv.invoice_number || 'INV'}`,
        amount: remaining,
        date: inv.due_at || inv.created_at,
        status: inv.status,
        description: totalPaid > 0 ? `$${(totalPaid/100).toFixed(2)} paid, $${(remaining/100).toFixed(2)} remaining` : 'Unpaid'
      };
    }).filter(inv => inv.amount > 0);

  const formatDeals = (deals: any[]): MetricDetail[] =>
    (deals ?? []).map(d => ({
      id: d.id,
      type: 'deal' as const,
      label: `${(d.clients as any)?.name || 'Unknown'} - ${d.title || 'Untitled Deal'}`,
      amount: d.value_cents,
      date: d.created_at,
      status: d.stage,
      description: `Stage: ${d.stage}`
    }));

  const result = {
    revenueThisMonth,
    totalRevenue,
    outstandingBalance,
    pipelineValue,
    clientsCount: clientsCount ?? 0,
    thisMonthPayments: formatPayments(thisMonthPayments),
    allPayments: formatPayments(allPayments),
    outstandingInvoices: formatInvoices(outstandingInvoices),
    openDeals: formatDeals(openDeals)
  };

  console.log('[analytics] Final result structure:', {
    revenueThisMonth,
    totalRevenue,
    outstandingBalance,
    pipelineValue,
    clientsCount: clientsCount ?? 0,
    thisMonthPaymentsCount: result.thisMonthPayments.length,
    allPaymentsCount: result.allPayments.length,
    outstandingInvoicesCount: result.outstandingInvoices.length,
    openDealsCount: result.openDeals.length
  });

  return result;
}