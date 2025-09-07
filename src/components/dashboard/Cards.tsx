'use client';

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-gray-600">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

interface KPIData {
  clientsCount: number;
  openDealsCount: number;
  pipelineValue: number;
  revenueThisMonth: number;
  outstandingBalance: number;
  totalDeals: number;
  wonDeals: number;
  totalWonValue: number;
  conversionRate: number;
  avgDealValue: number;
  dealsClosedThisMonth: number;
  overdueInvoices: number;
  avgPaymentTime: number;
  totalRevenue: number;
  recentPaymentCount: number;
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
      {/* Primary KPIs */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <MetricCard 
            label="Revenue (This Month)" 
            value={fmt(kpis.revenueThisMonth)}
          />
          <MetricCard 
            label="Pipeline Value" 
            value={fmt(kpis.pipelineValue)}
            subtext={`${kpis.openDealsCount} open deals`}
          />
          <MetricCard 
            label="Outstanding Balance" 
            value={fmt(kpis.outstandingBalance)}
            subtext={kpis.overdueInvoices > 0 ? `${kpis.overdueInvoices} overdue` : undefined}
          />
          <MetricCard 
            label="Total Clients" 
            value={kpis.clientsCount.toString()}
          />
          <MetricCard 
            label="Win Rate" 
            value={`${kpis.conversionRate}%`}
            subtext={`${kpis.wonDeals}/${kpis.totalDeals} deals won`}
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
