import { supabaseServer } from "@/lib/supabaseServer";

export interface MetricDetail {
  id: string;
  type: 'payment' | 'invoice';
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
  clientsCount: number;
  // Detailed breakdowns for popups
  thisMonthPayments: MetricDetail[];
  allPayments: MetricDetail[];
  outstandingInvoices: MetricDetail[];
}

export async function getAnalytics(orgId: string): Promise<AnalyticsData> {
  const supabase = await supabaseServer();

  // Get current month start - use UTC to avoid timezone issues
  const now = new Date();
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));


  // Get all payments this month with details
  const { data: thisMonthPayments } = await supabase
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

  // Get client count
  const { count: clientsCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Calculate metrics
  const revenueThisMonth = (thisMonthPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const totalRevenue = (allPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  // Calculate outstanding balance (invoice amount minus payments)
  const outstandingBalance = (outstandingInvoices ?? []).reduce((sum, inv) => {
    const totalPaid = (inv.invoice_payments ?? []).reduce((pSum, p) => pSum + (p.amount_cents ?? 0), 0);
    const remaining = Math.max(0, (inv.amount_cents ?? 0) - totalPaid);
    return sum + remaining;
  }, 0);

  // Format data for popups
  const formatPayments = (payments: any[]): MetricDetail[] => {
    return (payments ?? []).map(p => ({
      id: p.id,
      type: 'payment' as const,
      label: `${(p.invoices as any)?.clients?.name || 'Unknown'} - ${(p.invoices as any)?.invoice_number || 'INV'}`,
      amount: p.amount_cents,
      date: p.paid_at,
      description: `Payment via ${p.payment_method || 'card'}`
    }));
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

  return {
    revenueThisMonth,
    totalRevenue,
    outstandingBalance,
    clientsCount: clientsCount ?? 0,
    thisMonthPayments: formatPayments(thisMonthPayments ?? []),
    allPayments: formatPayments(allPayments ?? []),
    outstandingInvoices: formatInvoices(outstandingInvoices ?? [])
  };
}
