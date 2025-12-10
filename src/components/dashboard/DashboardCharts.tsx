'use client';

import useSWR from 'swr';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from 'recharts';

const fetcher = (u: string) => fetch(u).then(r => r.json());
const fmtUSD = (cents: number) => (cents/100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

// Format month from YYYY-MM to readable format
const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

export default function DashboardCharts() {
  const { data } = useSWR('/api/dashboard/charts', fetcher);

  return (
    <div className="space-y-8">
      {/* Revenue Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[500px]">
        <div className="rounded-2xl border bg-white p-6 flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Revenue by Month (YTD)</h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.revenueByMonth ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickFormatter={formatMonth}
                  interval="preserveStartEnd"
                />
                <YAxis tickFormatter={(v) => fmtUSD(v).replace('.00', '')} />
                <Tooltip
                  formatter={(value: any) => [fmtUSD(value as number), 'Revenue']}
                  labelFormatter={(label) => formatMonth(label as string)}
                />
                <Line
                  type="monotone"
                  dataKey="cents"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 flex flex-col">
          <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
          <div className="flex-1">
            {!data?.paymentMethods || data.paymentMethods.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <p>No payment data available</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.paymentMethods}
                  margin={{ top: 20, right: 10, left: 10, bottom: 45 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="method"
                    angle={-45}
                    textAnchor="end"
                    height={5}
                    tick={{ fontSize: 12 }}
                    interval={0}
                  />
                  <YAxis
                    tickFormatter={(v) => fmtUSD(v).replace('.00', '')}
                  />
                  <Tooltip
                    formatter={(value: any) => [fmtUSD(value as number), 'Total Amount']}
                    labelFormatter={(label) => `Payment Method: ${label}`}
                  />
                  <Bar
                    dataKey="amount_cents"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
