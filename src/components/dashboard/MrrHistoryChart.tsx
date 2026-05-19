'use client';

import useSWR from 'swr';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const fetcher = (u: string) => fetch(u).then((r) => r.json());
const fmt = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

const fmtMonth = (key: string) => {
  // key: 'YYYY-MM'
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
};

interface MonthPoint {
  month: string;
  mrrCents: number;
  subscriptionMrrCents: number;
  legacyMrrCents: number;
  activeCount: number;
}

interface HistoryData {
  months: MonthPoint[];
  momChangeCents: number;
  momChangePct: number | null;
}

interface MetricsData {
  mrrAtStartCents: number;
  newMrrCents: number;
  newCount: number;
  churnedMrrCents: number;
  churnedCount: number;
  netNewMrrCents: number;
  churnRatePct: number | null;
}

interface TooltipPayload {
  payload?: MonthPoint;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0 || !payload[0].payload) return null;
  const p: MonthPoint = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-gray-900 mb-1">
        {label ? fmtMonth(label) : ''}
      </div>
      <div className="text-gray-900 font-medium">{fmt(p.mrrCents)}</div>
      {p.subscriptionMrrCents > 0 && (
        <div className="text-emerald-700">Auto-pay: {fmt(p.subscriptionMrrCents)}</div>
      )}
      {p.legacyMrrCents > 0 && (
        <div className="text-slate-600">Invoiced: {fmt(p.legacyMrrCents)}</div>
      )}
      <div className="text-gray-500 mt-1">
        {p.activeCount} arrangement{p.activeCount === 1 ? '' : 's'}
      </div>
    </div>
  );
}

export default function MrrHistoryChart() {
  const { data: history, error: histErr } = useSWR<HistoryData>(
    '/api/dashboard/mrr-history',
    fetcher,
    { refreshInterval: 0 }
  );
  const { data: metrics } = useSWR<MetricsData>(
    '/api/dashboard/subscription-metrics',
    fetcher,
    { refreshInterval: 0 }
  );

  if (histErr) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2">MRR over time</h3>
        <div className="text-xs text-red-600">Failed to load.</div>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2">MRR over time</h3>
        <div className="text-xs text-gray-500 text-center py-12">Loading...</div>
      </div>
    );
  }

  const months = history.months || [];
  const allZero = months.every((m) => m.mrrCents === 0);
  const last = months[months.length - 1];
  const momPositive = (history.momChangeCents ?? 0) >= 0;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">MRR over time</h3>
          <p className="text-xs text-gray-500">Last 12 months · current month-to-date</p>
        </div>
        {last && (
          <div className="text-right">
            <div className="text-xl font-bold text-gray-900">{fmt(last.mrrCents)}</div>
            {history.momChangePct !== null && (
              <div className={`text-xs ${momPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                {momPositive ? '+' : ''}{history.momChangePct}% MoM
              </div>
            )}
          </div>
        )}
      </div>

      {/* Metric pills */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2">
            <div className="text-[10px] uppercase tracking-wide text-emerald-700">New MRR</div>
            <div className="text-sm font-semibold text-emerald-800">
              {fmt(metrics.newMrrCents)}
            </div>
            <div className="text-[10px] text-emerald-700/70">
              {metrics.newCount} this month
            </div>
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50/40 p-2">
            <div className="text-[10px] uppercase tracking-wide text-red-700">Churned</div>
            <div className="text-sm font-semibold text-red-800">
              {fmt(metrics.churnedMrrCents)}
            </div>
            <div className="text-[10px] text-red-700/70">
              {metrics.churnedCount} this month
            </div>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-2">
            <div className="text-[10px] uppercase tracking-wide text-indigo-700">
              Net new
            </div>
            <div className={`text-sm font-semibold ${
              metrics.netNewMrrCents >= 0 ? 'text-indigo-800' : 'text-red-800'
            }`}>
              {metrics.netNewMrrCents >= 0 ? '+' : ''}{fmt(metrics.netNewMrrCents)}
            </div>
            <div className="text-[10px] text-indigo-700/70">
              {metrics.churnRatePct !== null
                ? `${metrics.churnRatePct}% churn`
                : 'no churn data'}
            </div>
          </div>
        </div>
      )}

      {allZero ? (
        <div className="text-sm text-gray-500 text-center py-10">
          No recurring revenue history yet. Once you have active subscriptions or recurring
          invoices, this chart will fill in.
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="mrrGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={fmtMonth}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickFormatter={(v) => `$${Math.round(v / 100)}`}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="mrrCents"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#mrrGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
