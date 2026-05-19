'use client';

import useSWR from 'swr';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  const [y, m] = key.split('-');
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'short' });
};

interface MonthPoint {
  month: string;
  recurringCents: number;
  oneOffCents: number;
  totalCents: number;
}

interface Totals {
  recurringCents: number;
  oneOffCents: number;
  totalCents: number;
  recurringPct: number | null;
}

interface MixData {
  months: MonthPoint[];
  totals: Totals;
  period: { monthsBack: number; startIso: string };
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
      <div className="text-emerald-700">Recurring: {fmt(p.recurringCents)}</div>
      <div className="text-blue-600">One-off: {fmt(p.oneOffCents)}</div>
      <div className="text-gray-900 font-medium border-t mt-1 pt-1">
        Total: {fmt(p.totalCents)}
      </div>
    </div>
  );
}

export default function RevenueMixChart() {
  const { data, error } = useSWR<MixData>('/api/dashboard/revenue-mix?months=6', fetcher, {
    refreshInterval: 0,
  });

  if (error) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Revenue mix</h3>
        <div className="text-xs text-red-600">Failed to load.</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="bg-white border rounded-xl p-4">
        <h3 className="font-semibold text-gray-800 mb-2">Revenue mix</h3>
        <div className="text-xs text-gray-500 text-center py-12">Loading...</div>
      </div>
    );
  }

  const months = data.months || [];
  const allZero = months.every((m) => m.totalCents === 0);
  const pct = data.totals.recurringPct;

  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-800">
            Invoice revenue mix
          </h3>
          <p className="text-xs text-gray-500">
            Last 6 months · invoiced payments only
          </p>
          <p
            className="text-[11px] text-gray-400 mt-0.5"
            title="Stripe auto-pay subscription revenue is shown in the MRR chart only — it doesn't flow through the invoices table."
          >
            Stripe subscription revenue not included
          </p>
        </div>
        {pct !== null && (
          <div className="text-right">
            <div className="text-sm font-semibold text-emerald-700">{pct}% recurring</div>
            <div className="text-xs text-gray-500">{fmt(data.totals.totalCents)} total</div>
          </div>
        )}
      </div>

      {allZero ? (
        <div className="text-sm text-gray-500 text-center py-10">
          No payments yet in this window.
        </div>
      ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
              />
              <Bar dataKey="recurringCents" name="Recurring" stackId="rev" fill="#10b981" />
              <Bar dataKey="oneOffCents" name="One-off" stackId="rev" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
