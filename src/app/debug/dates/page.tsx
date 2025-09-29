'use client';

import { prettyDate } from '@/lib/ui';

export default function DateDebugPage() {
  const testDates = [
    "2025-10-01",
    "2025-11-01",
    "2025-09-30",
    "2025-10-31"
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Date Debug Page</h1>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Current timezone:</h2>
          <p>{Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Date Conversions:</h2>
          <table className="border border-gray-300">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2">Input String</th>
                <th className="border border-gray-300 p-2">new Date()</th>
                <th className="border border-gray-300 p-2">prettyDate()</th>
                <th className="border border-gray-300 p-2">toLocaleDateString()</th>
              </tr>
            </thead>
            <tbody>
              {testDates.map(date => (
                <tr key={date}>
                  <td className="border border-gray-300 p-2">{date}</td>
                  <td className="border border-gray-300 p-2">{new Date(date).toString()}</td>
                  <td className="border border-gray-300 p-2">{prettyDate(date)}</td>
                  <td className="border border-gray-300 p-2">{new Date(date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h2 className="text-lg font-semibold">Sample API Data Test:</h2>
          <div className="bg-gray-100 p-4 rounded">
            <p><strong>Johnathan Hansen:</strong> {prettyDate("2025-11-01")}</p>
            <p><strong>Chris Pinto:</strong> {prettyDate("2025-10-01")}</p>
            <p><strong>Expected:</strong> 11/1/2025 and 10/1/2025</p>
          </div>
        </div>
      </div>
    </div>
  );
}