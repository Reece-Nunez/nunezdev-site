"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnalyticsData, MetricDetail, ClientRevenue, UpcomingInvoice, RecurringInvoiceStatus, InvoiceStatusSummary } from "@/lib/analytics";
import DashboardCharts from "./DashboardCharts";
import { useRealtimeEvents, RealtimeEvent } from "@/hooks/useRealtimeEvents";

interface DashboardClientProps {
  kpis: AnalyticsData | null;
}

// Currency formatter
const fmt = (cents: number) => {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(dollars);
};

// Date formatter
const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

// Relative time formatter
const formatRelativeDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays === 0) return 'Due today';
  if (diffDays === 1) return 'Due tomorrow';
  if (diffDays <= 7) return `Due in ${diffDays} days`;
  return formatDate(dateStr);
};

// Activity Item Type
interface ActivityItem {
  type: 'note' | 'invoice' | 'task' | 'payment';
  ts: string;
  data: any;
}

// Greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

// Metric Detail Modal
function MetricDetailModal({
  title,
  items,
  onClose
}: {
  title: string;
  items: MetricDetail[];
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-lg">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {items.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No items to display</p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.id || idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500">{formatDate(item.date)} {item.description && `• ${item.description}`}</div>
                  </div>
                  <div className="font-semibold text-sm">{fmt(item.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardClient({ kpis }: DashboardClientProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState<string | null>(null);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [paymentNotification, setPaymentNotification] = useState<{ message: string; visible: boolean } | null>(null);

  // Real-time updates via SSE
  const handlePaymentEvent = useCallback((event: RealtimeEvent) => {
    const amount = event.event_data.amount_cents
      ? fmt(event.event_data.amount_cents)
      : '';
    const clientName = event.event_data.client_name || 'A client';
    const label = event.event_data.installment_label || 'Payment';

    // Show notification
    setPaymentNotification({
      message: `${clientName}: ${label} of ${amount} received!`,
      visible: true
    });

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setPaymentNotification(prev => prev ? { ...prev, visible: false } : null);
    }, 5000);
  }, []);

  useRealtimeEvents({
    onPaymentReceived: handlePaymentEvent,
    onInstallmentPaid: handlePaymentEvent,
    onRefresh: () => router.refresh(),
    enabled: true,
  });

  // Fetch activity data
  useEffect(() => {
    async function fetchActivity() {
      try {
        const res = await fetch('/api/dashboard/activity');
        if (res.ok) {
          const data = await res.json();
          setActivityItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch activity:', error);
      } finally {
        setActivityLoading(false);
      }
    }
    fetchActivity();
  }, []);

  if (!kpis) {
    return (
      <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
        <div className="rounded-xl border bg-white p-4 text-sm text-red-600">
          Failed to load KPIs. You might not have owner access.
        </div>
      </div>
    );
  }

  const {
    revenueThisMonth,
    revenueLastMonth,
    totalRevenue,
    revenueLastYear,
    outstandingBalance,
    clientsCount,
    avgPaymentDays,
    overdueCount,
    overdueAmount,
    thisMonthPayments,
    allPayments,
    outstandingInvoices,
    topClients,
    upcomingInvoices,
    overdueInvoices,
    recurringInvoices,
    invoiceStatusSummary
  } = kpis;

  // Calculate month-over-month change
  const momChange = revenueLastMonth > 0
    ? ((revenueThisMonth - revenueLastMonth) / revenueLastMonth * 100).toFixed(1)
    : revenueThisMonth > 0 ? '+100' : '0';
  const momPositive = Number(momChange) >= 0;

  return (
    <div className="px-3 py-4 sm:p-6 space-y-6 max-w-full min-w-0">
      {/* Payment Notification Banner */}
      {paymentNotification?.visible && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-right duration-300">
          <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">{paymentNotification.message}</span>
            <button
              onClick={() => setPaymentNotification(null)}
              className="ml-2 text-white/80 hover:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-4 sm:p-6 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold">{getGreeting()}, Reece</h1>
            <p className="text-emerald-100 text-sm mt-1">
              {overdueCount > 0 ? (
                <>You have <span className="font-semibold text-white">{overdueCount} overdue invoice{overdueCount !== 1 ? 's' : ''}</span> totaling <span className="font-semibold text-white">{fmt(overdueAmount)}</span></>
              ) : outstandingInvoices.length > 0 ? (
                <>You have <span className="font-semibold text-white">{outstandingInvoices.length} outstanding invoice{outstandingInvoices.length !== 1 ? 's' : ''}</span> worth {fmt(outstandingBalance)}</>
              ) : (
                "All invoices are paid - great job!"
              )}
            </p>
          </div>
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Link href="/dashboard/invoices/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Invoice
            </Link>
            <Link href="/dashboard/clients/new" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              Add Client
            </Link>
            <Link href="/dashboard/payments" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Record Payment
            </Link>
            {overdueCount > 0 && (
              <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                View Overdue
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Key Metrics - 4 cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Revenue This Month */}
        <div
          className="bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setModalOpen('thisMonth')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-500">Revenue This Month</span>
            <span className="text-emerald-600 text-lg">$</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{fmt(revenueThisMonth)}</div>
          <div className={`text-xs mt-1 ${momPositive ? 'text-emerald-600' : 'text-red-600'}`}>
            {momPositive ? '+' : ''}{momChange}% vs last month
          </div>
        </div>

        {/* Outstanding Balance */}
        <div
          className="bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setModalOpen('outstanding')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-500">Outstanding</span>
            <span className="text-amber-600 text-lg">!</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{fmt(outstandingBalance)}</div>
          <div className="text-xs text-gray-500 mt-1">{outstandingInvoices.length} invoice{outstandingInvoices.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Total Revenue */}
        <div
          className="bg-white rounded-xl border p-4 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => setModalOpen('total')}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-500">Total Revenue</span>
            <span className="text-blue-600 text-lg">$</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{fmt(totalRevenue)}</div>
          <div className="text-xs text-gray-500 mt-1">{allPayments.length} payment{allPayments.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Avg Payment Time */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs sm:text-sm text-gray-500">Avg Payment Time</span>
            <span className="text-purple-600 text-lg">~</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-gray-900">{avgPaymentDays} days</div>
          <div className="text-xs text-gray-500 mt-1">From issue to payment</div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left Column - Overdue & Upcoming Invoices */}
        <div className="xl:col-span-2 space-y-6">
          {/* Overdue Invoices Alert */}
          {overdueInvoices.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Overdue Invoices ({overdueInvoices.length})
                </h3>
                <Link href="/dashboard/invoices" className="text-sm text-red-600 hover:text-red-800">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {overdueInvoices.slice(0, 3).map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/dashboard/invoices/${inv.id}`}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100 hover:border-red-300 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">{inv.clientName}</div>
                      <div className="text-xs text-red-600">{inv.invoiceNumber} • {Math.abs(inv.daysUntilDue)} days overdue</div>
                    </div>
                    <div className="font-semibold text-red-700">{fmt(inv.amount)}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Upcoming Invoices */}
          {upcomingInvoices.length > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Upcoming Due
                </h3>
                <Link href="/dashboard/invoices" className="text-sm text-emerald-600 hover:text-emerald-800">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {upcomingInvoices.slice(0, 3).map((inv) => (
                  <Link
                    key={inv.id}
                    href={`/dashboard/invoices/${inv.id}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">{inv.clientName}</div>
                      <div className="text-xs text-gray-500">{inv.invoiceNumber} • {formatRelativeDate(inv.dueAt)}</div>
                    </div>
                    <div className="font-semibold text-gray-700">{fmt(inv.amount)}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Charts */}
          <DashboardCharts />

          {/* Recent Activity */}
          <div className="bg-white border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Recent Activity</h3>
            </div>
            {activityLoading ? (
              <div className="text-sm text-gray-500 text-center py-4">Loading activity...</div>
            ) : activityItems.length === 0 ? (
              <div className="text-sm text-gray-500 text-center py-4">No recent activity</div>
            ) : (
              <div className="space-y-2">
                {activityItems.slice(0, 8).map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0 ${
                      item.type === 'invoice' ? 'bg-blue-100 text-blue-600' :
                      item.type === 'note' ? 'bg-yellow-100 text-yellow-600' :
                      item.type === 'task' ? 'bg-purple-100 text-purple-600' :
                      'bg-emerald-100 text-emerald-600'
                    }`}>
                      {item.type === 'invoice' ? '📄' : item.type === 'note' ? '📝' : item.type === 'task' ? '✓' : '💰'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 truncate">
                        {item.type === 'invoice' && `Invoice ${item.data.status} - ${fmt(item.data.amount_cents || 0)}`}
                        {item.type === 'note' && (item.data.body?.substring(0, 50) || 'Note added')}
                        {item.type === 'task' && (item.data.title || 'Task created')}
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(item.ts)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Top Clients & Recurring */}
        <div className="space-y-6">
          {/* Business Stats */}
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Business Overview</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-600">Total Clients</span>
                <span className="font-semibold">{clientsCount}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-600">Total Payments</span>
                <span className="font-semibold">{allPayments.length}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm text-gray-600">Payments This Month</span>
                <span className="font-semibold">{thisMonthPayments.length}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Last Year Revenue</span>
                <span className="font-semibold">{fmt(revenueLastYear)}</span>
              </div>
            </div>
          </div>

          {/* Top Clients */}
          {topClients.length > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Top Clients</h3>
                <Link href="/dashboard/clients" className="text-sm text-emerald-600 hover:text-emerald-800">
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {topClients.map((client, idx) => (
                  <Link
                    key={client.id}
                    href={`/dashboard/clients/${client.id}`}
                    className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${
                      idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-gray-400' : idx === 2 ? 'bg-amber-700' : 'bg-gray-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">{client.name}</div>
                      <div className="text-xs text-gray-500">{client.paymentCount} payment{client.paymentCount !== 1 ? 's' : ''}</div>
                    </div>
                    <div className="font-semibold text-sm text-emerald-600">{fmt(client.totalRevenue)}</div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Invoice Status Summary */}
          {invoiceStatusSummary.length > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800">Invoice Status</h3>
                <Link href="/dashboard/invoices" className="text-sm text-emerald-600 hover:text-emerald-800">
                  View all
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                      <th className="pb-2">Status</th>
                      <th className="pb-2 text-center">Count</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {invoiceStatusSummary.map((row) => {
                      const statusColors: Record<string, string> = {
                        draft: 'bg-gray-100 text-gray-700',
                        sent: 'bg-blue-100 text-blue-700',
                        overdue: 'bg-red-100 text-red-700',
                        partially_paid: 'bg-amber-100 text-amber-700',
                        paid: 'bg-emerald-100 text-emerald-700',
                        cancelled: 'bg-gray-100 text-gray-500'
                      };
                      const statusLabels: Record<string, string> = {
                        draft: 'Draft',
                        sent: 'Sent',
                        overdue: 'Overdue',
                        partially_paid: 'Partial',
                        paid: 'Paid',
                        cancelled: 'Cancelled'
                      };
                      return (
                        <tr key={row.status}>
                          <td className="py-2">
                            <Link
                              href="/dashboard/invoices"
                              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColors[row.status] || 'bg-gray-100 text-gray-700'} hover:opacity-80`}
                            >
                              {statusLabels[row.status] || row.status}
                            </Link>
                          </td>
                          <td className="py-2 text-center text-sm font-medium text-gray-900">{row.count}</td>
                          <td className="py-2 text-right text-sm font-semibold text-gray-900">{fmt(row.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-200">
                      <td className="pt-2 text-sm font-semibold text-gray-900">Total</td>
                      <td className="pt-2 text-center text-sm font-semibold text-gray-900">
                        {invoiceStatusSummary.reduce((sum, r) => sum + r.count, 0)}
                      </td>
                      <td className="pt-2 text-right text-sm font-semibold text-gray-900">
                        {fmt(invoiceStatusSummary.reduce((sum, r) => sum + r.amount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Recurring Invoices */}
          {recurringInvoices.length > 0 && (
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Recurring Invoices
                </h3>
                <Link href="/dashboard/recurring" className="text-sm text-emerald-600 hover:text-emerald-800">
                  Manage
                </Link>
              </div>
              <div className="space-y-2">
                {recurringInvoices.slice(0, 4).map((ri) => (
                  <div
                    key={ri.id}
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm text-gray-900">{ri.clientName}</div>
                      <div className="text-xs text-gray-500">
                        {ri.frequency} • Next: {ri.nextRunAt ? formatDate(ri.nextRunAt) : 'N/A'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-sm">{fmt(ri.amount)}</div>
                      <div className={`text-xs ${ri.isActive ? 'text-emerald-600' : 'text-gray-400'}`}>
                        {ri.isActive ? 'Active' : 'Paused'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modalOpen === 'thisMonth' && (
        <MetricDetailModal
          title="Revenue This Month"
          items={thisMonthPayments}
          onClose={() => setModalOpen(null)}
        />
      )}
      {modalOpen === 'outstanding' && (
        <MetricDetailModal
          title="Outstanding Invoices"
          items={outstandingInvoices}
          onClose={() => setModalOpen(null)}
        />
      )}
      {modalOpen === 'total' && (
        <MetricDetailModal
          title="All Payments"
          items={allPayments}
          onClose={() => setModalOpen(null)}
        />
      )}
    </div>
  );
}
