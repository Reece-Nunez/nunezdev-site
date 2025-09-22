'use client';

import ClickableMetric from '@/components/analytics/ClickableMetric';
import type { AnalyticsData } from '@/lib/analytics';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

interface KPIData extends AnalyticsData {
  // Legacy props for backward compatibility
  openDealsCount?: number;
  totalDeals?: number;
  wonDeals?: number;
  totalWonValue?: number;
  conversionRate?: number;
  avgDealValue?: number;
  dealsClosedThisMonth?: number;
  overdueInvoices?: number;
  avgPaymentTime?: number;
  recentPaymentCount?: number;
}

function MetricCard({ label, value, subtext, trend }: { 
  label: string; 
  value: string; 
  subtext?: string;
  trend?: { value: number; label: string };
}) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-1">{subtext}</div>}
      {trend && (
        <div className={`text-xs mt-1 flex items-center ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          <span className="mr-1">{trend.value >= 0 ? '↗' : '↘'}</span>
          {trend.label}
        </div>
      )}
    </div>
  );
}

export default function Cards({ kpis }: { kpis: KPIData }) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString(undefined, {
      style: 'currency',
      currency: 'USD',
    });

  return (
    <div className="space-y-6">
      {/* Primary KPIs - Now Clickable */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <ClickableMetric
            title="Revenue (This Month)"
            value={fmt(kpis.revenueThisMonth)}
            color="green"
            details={kpis.thisMonthPayments || []}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            }
          />
          <ClickableMetric
            title="Pipeline Value"
            value={fmt(kpis.pipelineValue)}
            color="purple"
            details={kpis.openDeals || []}
            subtitle={`${(kpis.openDeals || []).length} open deals`}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            }
          />
          <ClickableMetric
            title="Outstanding Balance"
            value={fmt(kpis.outstandingBalance)}
            color="blue"
            details={kpis.outstandingInvoices || []}
            subtitle={(kpis.outstandingInvoices || []).length > 0 ? `${(kpis.outstandingInvoices || []).length} invoices` : 'All paid!'}
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
            }
          />
          <ClickableMetric
            title="Total Revenue"
            value={fmt(kpis.totalRevenue)}
            color="green"
            details={kpis.allPayments || []}
            subtitle="All-time revenue"
            icon={
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
            }
          />
          <MetricCard
            label="Total Clients"
            value={kpis.clientsCount.toString()}
          />
        </div>
      </div>

      {/* Secondary KPIs */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Performance Insights</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard 
            label="Avg Deal Value" 
            value={fmt(kpis.avgDealValue)}
          />
          <MetricCard 
            label="Deals Closed (Month)" 
            value={kpis.dealsClosedThisMonth.toString()}
          />
          <MetricCard 
            label="Total Won Value" 
            value={fmt(kpis.totalWonValue)}
          />
          <MetricCard 
            label="Avg Payment Time" 
            value={`${kpis.avgPaymentTime}d`}
            subtext="Days to payment"
          />
        </div>
      </div>

      {/* Business Overview */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Business Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <MetricCard 
            label="Total Revenue" 
            value={fmt(kpis.totalRevenue)}
            subtext="All-time revenue"
          />
          <MetricCard 
            label="Recent Payments" 
            value={kpis.recentPaymentCount.toString()}
            subtext="Last 30 days"
          />
          <MetricCard 
            label="Total Deals" 
            value={kpis.totalDeals.toString()}
            subtext={`${kpis.wonDeals} won, ${kpis.totalDeals - kpis.wonDeals} other`}
          />
        </div>
      </div>
    </div>
  );
}
