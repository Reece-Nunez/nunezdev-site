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
}

interface InvoiceAnalyticsProps {
  invoices: Invoice[];
}

export default function InvoiceAnalytics({ invoices }: InvoiceAnalyticsProps) {
  const analytics = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    // Status breakdown
    const statusBreakdown = invoices.reduce((acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Revenue calculations
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.amount_cents, 0);

    const pendingRevenue = invoices
      .filter(inv => ['sent', 'overdue'].includes(inv.status))
      .reduce((sum, inv) => sum + inv.amount_cents, 0);

    const thisMonthRevenue = invoices
      .filter(inv => 
        inv.status === 'paid' && 
        inv.issued_at && 
        new Date(inv.issued_at) >= thisMonth
      )
      .reduce((sum, inv) => sum + inv.amount_cents, 0);

    const lastMonthRevenue = invoices
      .filter(inv => 
        inv.status === 'paid' && 
        inv.issued_at && 
        new Date(inv.issued_at) >= lastMonth && 
        new Date(inv.issued_at) < thisMonth
      )
      .reduce((sum, inv) => sum + inv.amount_cents, 0);

    // Overdue invoices
    const overdueInvoices = invoices.filter(inv => 
      inv.status === 'sent' && 
      inv.due_at && 
      new Date(inv.due_at) < now
    );

    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount_cents, 0);

    // Average invoice value
    const avgInvoiceValue = invoices.length > 0 
      ? invoices.reduce((sum, inv) => sum + inv.amount_cents, 0) / invoices.length 
      : 0;

    // Month-over-month growth
    const momGrowth = lastMonthRevenue > 0 
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 
      : 0;

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
    };
  }, [invoices]);

  const formatCurrency = (cents: number) => 
    (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

  const formatPercentage = (value: number) => 
    value > 0 ? `+${value.toFixed(1)}%` : `${value.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* Total Revenue */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(analytics.totalRevenue)}
            </p>
          </div>
          <div className="p-2 bg-green-100 rounded-lg">
            <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Pending Revenue */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Pending Revenue</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(analytics.pendingRevenue)}
            </p>
            <p className="text-xs text-gray-500">
              {analytics.statusBreakdown.sent || 0} sent invoices
            </p>
          </div>
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* This Month */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">This Month</p>
            <p className="text-2xl font-bold text-gray-800">
              {formatCurrency(analytics.thisMonthRevenue)}
            </p>
            <p className={`text-xs ${analytics.momGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatPercentage(analytics.momGrowth)} vs last month
            </p>
          </div>
          <div className="p-2 bg-gray-100 rounded-lg">
            <svg className="w-6 h-6 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Overdue */}
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Overdue</p>
            <p className="text-2xl font-bold text-red-600">
              {formatCurrency(analytics.overdueAmount)}
            </p>
            <p className="text-xs text-gray-500">
              {analytics.overdueInvoices} invoice{analytics.overdueInvoices !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="p-2 bg-red-100 rounded-lg">
            <svg className="w-6 h-6 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
        <h3 className="font-semibold text-gray-800 mb-3">Invoice Status</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
            <div key={status} className="flex justify-between">
              <span className="capitalize text-gray-600">{status}:</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
        <h3 className="font-semibold text-gray-800 mb-3">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Invoices:</span>
            <span className="font-medium">{invoices.length}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Avg Invoice:</span>
            <span className="font-medium">{formatCurrency(analytics.avgInvoiceValue)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Success Rate:</span>
            <span className="font-medium">
              {invoices.length > 0 
                ? ((analytics.statusBreakdown.paid || 0) / invoices.length * 100).toFixed(1)
                : 0}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Collection Time:</span>
            <span className="font-medium">~14 days</span>
          </div>
        </div>
      </div>
    </div>
  );
}