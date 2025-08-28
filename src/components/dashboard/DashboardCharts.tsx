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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="text-sm font-semibold mb-2">Pipeline by Stage</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.pipelineByStage ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="stage" />
              <YAxis tickFormatter={(v) => fmtUSD(v).replace('$', '$').replace('.00', '')} />
              <Tooltip 
                formatter={(value: any) => [fmtUSD(value as number), 'Pipeline Value']}
                labelFormatter={(label) => `Stage: ${label}`}
              />
              <Bar dataKey="value_cents" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="rounded-2xl border bg-white p-4">
        <h3 className="text-sm font-semibold mb-2">Revenue by Month (YTD)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data?.revenueByMonth ?? []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tickFormatter={formatMonth}
                interval="preserveStartEnd"
              />
              <YAxis tickFormatter={(v) => fmtUSD(v).replace('$', '$').replace('.00', '')} />
              <Tooltip 
                formatter={(value: any) => [fmtUSD(value as number), 'Revenue']}
                labelFormatter={(label) => formatMonth(label as string)}
              />
              <Line 
                type="monotone" 
                dataKey="cents" 
                stroke="#3b82f6" 
                strokeWidth={2}
                dot={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
