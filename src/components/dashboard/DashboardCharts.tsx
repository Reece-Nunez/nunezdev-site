'use client';

import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (u: string) => fetch(u).then(r => r.json());
const fmtUSD = (cents: number) => (cents/100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

const formatMonth = (monthStr: string) => {
  const [year, month] = monthStr.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const CATEGORY_LABELS: Record<string, string> = {
  lead_fees: 'Lead Fees (Thumbtack, etc.)',
  software: 'Software & Subscriptions',
  hardware: 'Hardware & Equipment',
  hosting: 'Hosting & Infrastructure',
  marketing: 'Marketing & Advertising',
  travel: 'Travel',
  office: 'Office Supplies',
  meals: 'Meals & Entertainment',
  professional_services: 'Professional Services',
  insurance: 'Insurance',
  utilities: 'Utilities',
  other: 'Other',
};

export default function DashboardCharts() {
  const { data, isLoading } = useSWR('/api/dashboard/charts', fetcher);

  const revenueByMonth = (data?.revenueByMonth ?? []).filter((m: any) => m.cents > 0);
  const revenueByYear = (data?.revenueByYear ?? []).filter((y: any) => y.gross_cents > 0);
  const topExpenseCategories = data?.topExpenseCategories ?? [];
  const totalRevenue = revenueByMonth.reduce((sum: number, m: any) => sum + (m.cents || 0), 0);
  const totalFees = revenueByMonth.reduce((sum: number, m: any) => sum + (m.fees_cents || 0), 0);
  const totalExpenses = revenueByMonth.reduce((sum: number, m: any) => sum + (m.expenses_cents || 0), 0);
  const totalNet = totalRevenue - totalFees;
  const totalProfit = totalNet - totalExpenses;
  const hasFees = totalFees > 0;
  const hasExpenses = totalExpenses > 0;

  return (
    <div className="space-y-6">
      {/* Yearly Revenue Summary */}
      {!isLoading && revenueByYear.length > 0 && (
        <div className="rounded-xl border bg-white">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-800">Yearly Overview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Year</th>
                  <th className="px-4 py-3 text-right">Gross Revenue</th>
                  {hasFees && <th className="px-4 py-3 text-right hidden sm:table-cell">Stripe Fees</th>}
                  {hasExpenses && <th className="px-4 py-3 text-right hidden sm:table-cell">Expenses</th>}
                  <th className="px-4 py-3 text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueByYear.map((yr: any, idx: number) => (
                  <tr key={yr.year} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{yr.year}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                      {fmtUSD(yr.gross_cents)}
                    </td>
                    {hasFees && (
                      <td className="px-4 py-3 text-sm text-right text-red-600 hidden sm:table-cell">
                        -{fmtUSD(yr.fees_cents)}
                      </td>
                    )}
                    {hasExpenses && (
                      <td className="px-4 py-3 text-sm text-right text-orange-600 hidden sm:table-cell">
                        -{fmtUSD(yr.expenses_cents)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700">
                      {fmtUSD(yr.profit_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {revenueByYear.length > 1 && (
                <tfoot>
                  <tr className="bg-gray-100 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900">{fmtUSD(totalRevenue)}</td>
                    {hasFees && (
                      <td className="px-4 py-3 text-sm text-right text-red-600 hidden sm:table-cell">-{fmtUSD(totalFees)}</td>
                    )}
                    {hasExpenses && (
                      <td className="px-4 py-3 text-sm text-right text-orange-600 hidden sm:table-cell">-{fmtUSD(totalExpenses)}</td>
                    )}
                    <td className="px-4 py-3 text-sm text-right text-emerald-700">{fmtUSD(totalProfit)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* Expense Breakdown by Category */}
      {!isLoading && topExpenseCategories.length > 0 && (
        <div className="rounded-xl border bg-white">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Expense Breakdown</h3>
            <Link href="/dashboard/expenses" className="text-sm text-emerald-600 hover:text-emerald-800">
              View all expenses
            </Link>
          </div>
          <div className="p-4">
            <div className="space-y-3">
              {topExpenseCategories.map((cat: any) => {
                const pct = totalExpenses > 0 ? ((cat.amount_cents / totalExpenses) * 100) : 0;
                return (
                  <div key={cat.category} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 w-48 truncate">
                      {CATEGORY_LABELS[cat.category] || cat.category}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-orange-400 h-2 rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 w-24 text-right">
                      {fmtUSD(cat.amount_cents)}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm font-semibold">
              <span className="text-gray-700">Total Expenses</span>
              <span className="text-orange-600">{fmtUSD(totalExpenses)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Monthly Revenue */}
      <div className="rounded-xl border bg-white">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Monthly Revenue</h3>
          <Link href="/dashboard/payments" className="text-sm text-emerald-600 hover:text-emerald-800">
            View all payments
          </Link>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : revenueByMonth.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No revenue data yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Month</th>
                  <th className="px-4 py-3 text-right">Gross</th>
                  {hasFees && <th className="px-4 py-3 text-right hidden sm:table-cell">Fees</th>}
                  {hasExpenses && <th className="px-4 py-3 text-right hidden sm:table-cell">Expenses</th>}
                  <th className="px-4 py-3 text-right hidden sm:table-cell">Profit</th>
                  <th className="px-4 py-3 text-right hidden sm:table-cell">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {revenueByMonth.map((month: any, idx: number) => {
                  const pct = totalRevenue > 0 ? ((month.cents / totalRevenue) * 100).toFixed(1) : '0';
                  return (
                    <tr key={month.month} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {formatMonth(month.month)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                        {fmtUSD(month.cents)}
                      </td>
                      {hasFees && (
                        <td className="px-4 py-3 text-sm text-right text-red-600 hidden sm:table-cell">
                          {month.fees_cents > 0 ? `-${fmtUSD(month.fees_cents)}` : '$0.00'}
                        </td>
                      )}
                      {hasExpenses && (
                        <td className="px-4 py-3 text-sm text-right text-orange-600 hidden sm:table-cell">
                          {month.expenses_cents > 0 ? `-${fmtUSD(month.expenses_cents)}` : '$0.00'}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-right font-semibold text-emerald-700 hidden sm:table-cell">
                        {fmtUSD(month.profit_cents)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-500 hidden sm:table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-emerald-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(100, parseFloat(pct))}%` }}
                            />
                          </div>
                          <span className="w-12 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-semibold">
                  <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-900">{fmtUSD(totalRevenue)}</td>
                  {hasFees && (
                    <td className="px-4 py-3 text-sm text-right text-red-600 hidden sm:table-cell">-{fmtUSD(totalFees)}</td>
                  )}
                  {hasExpenses && (
                    <td className="px-4 py-3 text-sm text-right text-orange-600 hidden sm:table-cell">-{fmtUSD(totalExpenses)}</td>
                  )}
                  <td className="px-4 py-3 text-sm text-right text-emerald-700 hidden sm:table-cell">{fmtUSD(totalProfit)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-500 hidden sm:table-cell">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
