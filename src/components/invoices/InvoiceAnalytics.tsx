'use client';

import { useMemo } from 'react';
import type { InvoiceStatus } from '@/types/invoice';

interface Invoice {
  id: string;
  status: InvoiceStatus;
  amount_cents: number;
  issued_at?: string;
  due_at?: string;
  created_at: string;
  invoice_payments?: Array<{
    amount_cents: number;
    payment_method: string;
    paid_at: string;
  }>;
}

interface InvoiceAnalyticsProps {
  invoices: Invoice[];
}

export default function InvoiceAnalytics({ invoices }: InvoiceAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    // Use UTC dates to avoid timezone issues
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
    
    // Helper function to calculate total payments for an invoice
    const getTotalPaid = (invoice: Invoice) => {
      return (invoice.invoice_payments || []).reduce((sum, payment) => sum + payment.amount_cents, 0);
    };
    
    // Helper function to get remaining balance
    const getRemainingBalance = (invoice: Invoice) => {
      const totalPaid = getTotalPaid(invoice);
      return Math.max(0, invoice.amount_cents - totalPaid);
    };

    // Enhanced invoice categorization with partial payments
    const invoiceCategories = invoices.reduce((acc, inv) => {
      const totalPaid = getTotalPaid(inv);
      const remainingBalance = getRemainingBalance(inv);
      
      if (inv.status === 'paid' || remainingBalance === 0) {
        acc.fullyPaid.push({ ...inv, totalPaid, remainingBalance });
      } else if (totalPaid > 0) {
        acc.partiallyPaid.push({ ...inv, totalPaid, remainingBalance });
      } else if (['sent', 'overdue'].includes(inv.status)) {
        acc.unpaid.push({ ...inv, totalPaid, remainingBalance });
      } else {
        acc.other.push({ ...inv, totalPaid, remainingBalance });
      }
      
      return acc;
    }, {
      fullyPaid: [] as Array<Invoice & { totalPaid: number; remainingBalance: number }>,
      partiallyPaid: [] as Array<Invoice & { totalPaid: number; remainingBalance: number }>,
      unpaid: [] as Array<Invoice & { totalPaid: number; remainingBalance: number }>,
      other: [] as Array<Invoice & { totalPaid: number; remainingBalance: number }>
    });
    
    // Status breakdown
    const statusBreakdown = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Total Revenue - sum of ALL payments received (regardless of invoice status)
    const totalRevenue = invoices
      .reduce((total, inv) => {
        const totalPaymentsReceived = (inv.invoice_payments || [])
          .reduce((sum, payment) => sum + payment.amount_cents, 0);
        return total + totalPaymentsReceived;
      }, 0);

    // Pending revenue is now the actual remaining balance (not full invoice amounts)
    const pendingRevenue = [...invoiceCategories.partiallyPaid, ...invoiceCategories.unpaid]
      .reduce((sum, inv) => sum + inv.remainingBalance, 0);

    // Calculate this month's revenue based on actual payment dates (paid_at)
    const thisMonthRevenue = invoices
      .reduce((total, inv) => {
        const paymentsThisMonth = (inv.invoice_payments || [])
          .filter(payment => {
            const paymentDate = new Date(payment.paid_at);
            return paymentDate >= thisMonth;
          })
          .reduce((sum, payment) => sum + payment.amount_cents, 0);
        return total + paymentsThisMonth;
      }, 0);

    // Calculate last month's revenue based on actual payment dates (paid_at)
    const lastMonthRevenue = invoices
      .reduce((total, inv) => {
        const paymentsLastMonth = (inv.invoice_payments || [])
          .filter(payment => {
            const paymentDate = new Date(payment.paid_at);
            return paymentDate >= lastMonth && paymentDate < thisMonth;
          })
          .reduce((sum, payment) => sum + payment.amount_cents, 0);
        return total + paymentsLastMonth;
      }, 0);

    // Overdue invoices - now includes partially paid overdue invoices
    const overdueInvoices = [...invoiceCategories.partiallyPaid, ...invoiceCategories.unpaid].filter(inv => 
      inv.due_at && 
      new Date(inv.due_at) < now
    );

    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.remainingBalance, 0);

    // Average invoice value
    const avgInvoiceValue = invoices.length > 0 
      ? invoices.reduce((sum, inv) => sum + inv.amount_cents, 0) / invoices.length 
      : 0;

    // Month-over-month growth
    const momGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

    // Partial payment statistics
    const partialPaymentTotal = invoiceCategories.partiallyPaid
      .reduce((sum, inv) => sum + inv.totalPaid, 0);
    const partialPaymentRemaining = invoiceCategories.partiallyPaid
      .reduce((sum, inv) => sum + inv.remainingBalance, 0);

    return {
      statusBreakdown,
      totalRevenue,
      pendingRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      overdueInvoices: overdueInvoices.length,
      overdueAmount,
      avgInvoiceValue,
      momGrowth,
      // New partial payment data
      partiallyPaidCount: invoiceCategories.partiallyPaid.length,
      partialPaymentTotal,
      partialPaymentRemaining,
      unpaidInvoices: invoiceCategories.unpaid.length,
      invoiceCategories, // For debugging or advanced features
    };
  }, [invoices]);

  const formatCurrency = (cents: number) => 
    (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

  const formatPercentage = (value: number) => 
    value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
      {/* Total Revenue */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-lg sm:text-2xl font-bold text-green-600">
              {formatCurrency(analytics.totalRevenue)}
            </p>
          </div>
          <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Pending Revenue */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Pending Revenue</p>
            <p className="text-lg sm:text-2xl font-bold text-blue-600">
              {formatCurrency(analytics.pendingRevenue)}
            </p>
            <div className="text-xs text-gray-500 space-y-0.5">
              <div>
                {analytics.unpaidInvoices} unpaid • {analytics.partiallyPaidCount} partial
              </div>
              {analytics.partiallyPaidCount > 0 && (
                <div className="text-emerald-600">
                  {formatCurrency(analytics.partialPaymentTotal)} received
                </div>
              )}
            </div>
          </div>
          <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* This Month */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">This Month</p>
            <p className="text-lg sm:text-2xl font-bold text-gray-800">
              {formatCurrency(analytics.thisMonthRevenue)}
            </p>
            <p className={`text-xs ${analytics.momGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(analytics.momGrowth)} vs last month
            </p>
          </div>
          <div className="p-1.5 sm:p-2 bg-gray-100 rounded-lg">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Overdue */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Overdue</p>
            <p className="text-lg sm:text-2xl font-bold text-red-600">
              {formatCurrency(analytics.overdueAmount)}
            </p>
            <p className="text-xs text-gray-500">
              {analytics.overdueInvoices} invoice{analytics.overdueInvoices !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
            <svg className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm sm:col-span-2 lg:col-span-2">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Invoice Status</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
            <div key={status} className="flex justify-between text-sm">
              <span className="capitalize text-gray-600 truncate pr-2">{status}:</span>
              <span className="font-medium flex-shrink-0">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl border bg-white p-3 sm:p-4 shadow-sm sm:col-span-2 lg:col-span-2">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Quick Stats</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 truncate pr-2">Total Invoices:</span>
            <span className="font-medium flex-shrink-0">{invoices.length}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 truncate pr-2">Avg Invoice:</span>
            <span className="font-medium flex-shrink-0">{formatCurrency(analytics.avgInvoiceValue)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 truncate pr-2">Success Rate:</span>
            <span className="font-medium flex-shrink-0">
              {invoices.length > 0 
                ? ((analytics.statusBreakdown.paid || 0) / invoices.length * 100).toFixed(1)
                : 0}%
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 truncate pr-2">Collection Time:</span>
            <span className="font-medium flex-shrink-0">~14 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}