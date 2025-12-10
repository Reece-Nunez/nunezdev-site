import { supabaseServer } from "@/lib/supabaseServer";

export interface MetricDetail {
  id: string;
  type: 'payment' | 'invoice';
  label: string;
  amount: number;
  date: string;
  status?: string;
  description?: string;
  clientId?: string;
}

export interface ClientRevenue {
  id: string;
  name: string;
  company?: string;
  totalRevenue: number;
  paymentCount: number;
}

export interface UpcomingInvoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientId: string;
  amount: number;
  dueAt: string;
  status: string;
  daysUntilDue: number;
}

export interface RecurringInvoiceStatus {
  id: string;
  clientName: string;
  title: string;
  amount: number;
  frequency: string;
  nextRunAt: string;
  isActive: boolean;
}

export interface InvoiceStatusSummary {
  status: string;
  count: number;
  amount: number;
}

export interface AnalyticsData {
  revenueThisMonth: number;
  revenueLastMonth: number;
  totalRevenue: number;
  revenueLastYear: number;
  outstandingBalance: number;
  clientsCount: number;
  avgPaymentDays: number;
  overdueCount: number;
  overdueAmount: number;
  // Detailed breakdowns for popups
  thisMonthPayments: MetricDetail[];
  allPayments: MetricDetail[];
  outstandingInvoices: MetricDetail[];
  // New data for dashboard widgets
  topClients: ClientRevenue[];
  upcomingInvoices: UpcomingInvoice[];
  overdueInvoices: UpcomingInvoice[];
  recurringInvoices: RecurringInvoiceStatus[];
  invoiceStatusSummary: InvoiceStatusSummary[];
}

export async function getAnalytics(orgId: string): Promise<AnalyticsData> {
  const supabase = await supabaseServer();

  // Get current dates for filtering
  const now = new Date();
  const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const lastMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
  const lastMonthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
  const lastYearStart = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1, 0, 0, 0, 0));
  const lastYearEnd = new Date(Date.UTC(now.getUTCFullYear() - 1, 11, 31, 23, 59, 59, 999));
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

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
        issued_at,
        client_id,
        clients!inner(id, name, company)
      )
    `)
    .eq("invoices.org_id", orgId)
    .gte("paid_at", thisMonthStart.toISOString())
    .order("paid_at", { ascending: false });

  // Get last month payments
  const { data: lastMonthPayments } = await supabase
    .from("invoice_payments")
    .select(`
      id,
      amount_cents,
      invoices!inner(org_id)
    `)
    .eq("invoices.org_id", orgId)
    .gte("paid_at", lastMonthStart.toISOString())
    .lte("paid_at", lastMonthEnd.toISOString());

  // Get last year's total payments
  const { data: lastYearPayments } = await supabase
    .from("invoice_payments")
    .select(`
      id,
      amount_cents,
      invoices!inner(org_id)
    `)
    .eq("invoices.org_id", orgId)
    .gte("paid_at", lastYearStart.toISOString())
    .lte("paid_at", lastYearEnd.toISOString());

  // Get all payments ever with details (for avg payment time calculation)
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
        issued_at,
        client_id,
        clients!inner(id, name, company)
      )
    `)
    .eq("invoices.org_id", orgId)
    .order("paid_at", { ascending: false });

  // Get outstanding invoices with remaining balances
  const { data: outstandingInvoicesRaw } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      amount_cents,
      status,
      due_at,
      client_id,
      clients!inner(id, name),
      invoice_payments(amount_cents)
    `)
    .eq("org_id", orgId)
    .in("status", ["sent", "overdue", "partially_paid"])
    .order("due_at", { ascending: true });

  // Get recurring invoices
  const { data: recurringInvoicesRaw } = await supabase
    .from("recurring_invoices")
    .select(`
      id,
      title,
      amount_cents,
      frequency,
      next_run_at,
      is_active,
      client_id,
      clients!inner(name)
    `)
    .eq("org_id", orgId)
    .order("next_run_at", { ascending: true });

  // Get all invoices for status summary
  const { data: allInvoicesRaw } = await supabase
    .from("invoices")
    .select(`
      id,
      status,
      amount_cents
    `)
    .eq("org_id", orgId);

  // Get client count
  const { count: clientsCount } = await supabase
    .from("clients")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  // Calculate metrics
  const revenueThisMonth = (thisMonthPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const revenueLastMonth = (lastMonthPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const totalRevenue = (allPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);
  const revenueLastYear = (lastYearPayments ?? []).reduce((sum, p) => sum + (p.amount_cents ?? 0), 0);

  // Calculate average payment time (days from invoice issue to payment)
  let avgPaymentDays = 0;
  const paymentsWithDates = (allPayments ?? []).filter(p =>
    p.paid_at && (p.invoices as any)?.issued_at
  );
  if (paymentsWithDates.length > 0) {
    const totalDays = paymentsWithDates.reduce((sum, p) => {
      const paidDate = new Date(p.paid_at);
      const issuedDate = new Date((p.invoices as any).issued_at);
      const diffDays = Math.max(0, Math.floor((paidDate.getTime() - issuedDate.getTime()) / (1000 * 60 * 60 * 24)));
      return sum + diffDays;
    }, 0);
    avgPaymentDays = Math.round(totalDays / paymentsWithDates.length);
  }

  // Calculate outstanding balance and overdue amounts
  let outstandingBalance = 0;
  let overdueAmount = 0;
  let overdueCount = 0;

  const processedInvoices = (outstandingInvoicesRaw ?? []).map(inv => {
    const totalPaid = (inv.invoice_payments ?? []).reduce((pSum: number, p: any) => pSum + (p.amount_cents ?? 0), 0);
    const remaining = Math.max(0, (inv.amount_cents ?? 0) - totalPaid);
    const dueDate = inv.due_at ? new Date(inv.due_at) : null;
    const daysUntilDue = dueDate ? Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const isOverdue = dueDate && dueDate < today && remaining > 0;

    outstandingBalance += remaining;
    if (isOverdue) {
      overdueAmount += remaining;
      overdueCount++;
    }

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number || 'N/A',
      clientName: (inv.clients as any)?.name || 'Unknown',
      clientId: inv.client_id,
      amount: remaining,
      dueAt: inv.due_at,
      status: inv.status,
      daysUntilDue,
      isOverdue
    };
  }).filter(inv => inv.amount > 0);

  // Split into overdue and upcoming
  const overdueInvoices: UpcomingInvoice[] = processedInvoices
    .filter(inv => inv.isOverdue)
    .map(({ isOverdue, ...rest }) => rest);

  const upcomingInvoices: UpcomingInvoice[] = processedInvoices
    .filter(inv => !inv.isOverdue)
    .slice(0, 5)
    .map(({ isOverdue, ...rest }) => rest);

  // Calculate top clients by revenue
  const clientRevenueMap = new Map<string, { id: string; name: string; company?: string; totalRevenue: number; paymentCount: number }>();
  (allPayments ?? []).forEach(p => {
    const client = (p.invoices as any)?.clients;
    if (!client?.id) return;

    if (!clientRevenueMap.has(client.id)) {
      clientRevenueMap.set(client.id, {
        id: client.id,
        name: client.name || 'Unknown',
        company: client.company,
        totalRevenue: 0,
        paymentCount: 0
      });
    }
    const stats = clientRevenueMap.get(client.id)!;
    stats.totalRevenue += p.amount_cents ?? 0;
    stats.paymentCount += 1;
  });

  const topClients: ClientRevenue[] = Array.from(clientRevenueMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // Format recurring invoices
  const recurringInvoices: RecurringInvoiceStatus[] = (recurringInvoicesRaw ?? []).map(ri => ({
    id: ri.id,
    clientName: (ri.clients as any)?.name || 'Unknown',
    title: ri.title || 'Recurring Invoice',
    amount: ri.amount_cents ?? 0,
    frequency: ri.frequency || 'monthly',
    nextRunAt: ri.next_run_at,
    isActive: ri.is_active ?? true
  }));

  // Calculate invoice status summary
  const statusMap = new Map<string, { count: number; amount: number }>();
  (allInvoicesRaw ?? []).forEach(inv => {
    const status = inv.status || 'unknown';
    if (!statusMap.has(status)) {
      statusMap.set(status, { count: 0, amount: 0 });
    }
    const entry = statusMap.get(status)!;
    entry.count += 1;
    entry.amount += inv.amount_cents ?? 0;
  });

  // Order statuses logically
  const statusOrder = ['draft', 'sent', 'overdue', 'partially_paid', 'paid', 'cancelled'];
  const invoiceStatusSummary: InvoiceStatusSummary[] = statusOrder
    .filter(s => statusMap.has(s))
    .map(s => ({
      status: s,
      count: statusMap.get(s)!.count,
      amount: statusMap.get(s)!.amount
    }));

  // Format data for popups
  const formatPayments = (payments: any[]): MetricDetail[] => {
    return (payments ?? []).map(p => ({
      id: p.id,
      type: 'payment' as const,
      label: `${(p.invoices as any)?.clients?.name || 'Unknown'} - ${(p.invoices as any)?.invoice_number || 'INV'}`,
      amount: p.amount_cents,
      date: p.paid_at,
      description: `Payment via ${p.payment_method || 'card'}`,
      clientId: (p.invoices as any)?.client_id
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
        description: totalPaid > 0 ? `$${(totalPaid/100).toFixed(2)} paid, $${(remaining/100).toFixed(2)} remaining` : 'Unpaid',
        clientId: inv.client_id
      };
    }).filter(inv => inv.amount > 0);

  return {
    revenueThisMonth,
    revenueLastMonth,
    totalRevenue,
    revenueLastYear,
    outstandingBalance,
    clientsCount: clientsCount ?? 0,
    avgPaymentDays,
    overdueCount,
    overdueAmount,
    thisMonthPayments: formatPayments(thisMonthPayments ?? []),
    allPayments: formatPayments(allPayments ?? []),
    outstandingInvoices: formatInvoices(outstandingInvoicesRaw ?? []),
    topClients,
    upcomingInvoices,
    overdueInvoices,
    recurringInvoices,
    invoiceStatusSummary
  };
}
