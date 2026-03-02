'use client';

import { useState } from 'react';
import ReportBuilder from '@/components/dashboard/client-reports/ReportBuilder';
import ReportHistory from '@/components/dashboard/client-reports/ReportHistory';

export default function ClientReportsPage() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Reports</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and send monthly technical partner reports to your clients
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('create')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'create'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Create Report
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'history'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Report History
        </button>
      </div>

      {activeTab === 'create' ? (
        <ReportBuilder onReportSaved={() => setRefreshKey(k => k + 1)} />
      ) : (
        <ReportHistory key={refreshKey} />
      )}
    </div>
  );
}
