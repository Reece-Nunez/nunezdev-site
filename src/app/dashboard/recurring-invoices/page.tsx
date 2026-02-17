'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { currency, prettyDate } from '@/lib/ui';

interface RecurringInvoice {
  id: string;
  title: string;
  description: string;
  amount_cents: number;
  frequency: string;
  status: string;
  start_date: string;
  end_date?: string;
  next_invoice_date: string;
  day_of_month?: number;
  total_invoices_sent: number;
  last_invoice_sent_at?: string;
  payment_terms: string | number;
  require_signature: boolean;
  send_reminder: boolean;
  reminder_days_before: number;
  brand_logo_url?: string;
  brand_primary?: string;
  clients: {
    id: string;
    name: string;
    email: string;
    company?: string;
  };
  created_at: string;
}

interface RecurringInvoicesData {
  recurring_invoices: RecurringInvoice[];
  count: number;
}

interface InvoiceLog {
  id: string;
  event_type: string;
  status: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  recurring_invoice_id: string | null;
  invoice_id: string | null;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RecurringInvoicesPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'cancelled' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<RecurringInvoice | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');
  const [today, setToday] = useState<string>('');
  const [showLogs, setShowLogs] = useState(false);
  const [logFilter, setLogFilter] = useState<string>('all');

  useEffect(() => {
    setToday(new Date().toISOString().split('T')[0]);
  }, []);

  const { data, error, isLoading } = useSWR<RecurringInvoicesData>(
    `/api/recurring-invoices?status=${statusFilter}`,
    fetcher
  );

  const { data: logsData, mutate: mutateLogs } = useSWR<{ logs: InvoiceLog[] }>(
    showLogs ? `/api/recurring-invoices/logs?limit=100${logFilter !== 'all' ? `&event_type=${logFilter}` : ''}` : null,
    fetcher
  );

  const updateStatus = async (invoiceId: string, newStatus: string) => {
    setActionLoading(invoiceId);
    try {
      const response = await fetch('/api/recurring-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: invoiceId, status: newStatus }),
      });

      if (!response.ok) throw new Error('Update failed');

      // Refresh data
      mutate(`/api/recurring-invoices?status=${statusFilter}`);
    } catch (error) {
      console.error('Failed to update status:', error);
      alert('Failed to update recurring invoice status');
    } finally {
      setActionLoading('');
    }
  };

  const processRecurringInvoices = async () => {
    setActionLoading('process-all');
    try {
      const response = await fetch('/api/recurring-invoices/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Processing failed');

      if (result.summary) {
        alert(`Processing complete! ${result.summary.successful} invoices sent successfully, ${result.summary.errors} errors.`);
      } else {
        alert(result.message || 'No recurring invoices due for processing.');
      }

      // Refresh data and logs
      mutate(`/api/recurring-invoices?status=${statusFilter}`);
      if (showLogs) mutateLogs();
    } catch (error) {
      console.error('Failed to process recurring invoices:', error);
      alert('Failed to process recurring invoices');
    } finally {
      setActionLoading('');
    }
  };

  const refreshData = async () => {
    setActionLoading('refresh');
    try {
      // Force refresh by fetching fresh data with cache busting
      const timestamp = Date.now();
      const freshUrl = `/api/recurring-invoices?status=${statusFilter}&t=${timestamp}`;

      // Fetch fresh data and update cache
      await mutate(`/api/recurring-invoices?status=${statusFilter}`,
        fetch(freshUrl).then(r => r.json()),
        { revalidate: false }
      );

      // Show success message
      alert('Data refreshed successfully!');
    } catch (error) {
      console.error('Failed to refresh data:', error);
      alert('Failed to refresh data. Please try again or reload the page.');
    } finally {
      setActionLoading('');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-gray-100 text-gray-800'
    };
    return statusStyles[status as keyof typeof statusStyles] || 'bg-gray-100 text-gray-800';
  };

  const getFrequencyText = (frequency: string) => {
    const frequencies = {
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly',
      annually: 'Annually'
    };
    return frequencies[frequency as keyof typeof frequencies] || frequency;
  };

  if (isLoading) return <div className="p-6 my-36">Loading recurring invoices...</div>;
  if (error) return <div className="p-6 my-36 text-red-600">Failed to load recurring invoices</div>;

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Recurring Invoices</h1>
          <p className="text-gray-600">Automate monthly hosting, maintenance, and subscription billing</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={refreshData}
            disabled={actionLoading === 'refresh'}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {actionLoading === 'refresh' ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={processRecurringInvoices}
            disabled={actionLoading === 'process-all'}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {actionLoading === 'process-all' ? 'Processing...' : 'Process Due Invoices'}
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Recurring Invoice
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="text-sm text-gray-600">Total Recurring</div>
            <div className="text-2xl font-bold">{data.count}</div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="text-sm text-gray-600">Active</div>
            <div className="text-2xl font-bold text-green-600">
              {data.recurring_invoices.filter(ri => ri.status === 'active').length}
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="text-sm text-gray-600">Monthly Revenue</div>
            <div className="text-2xl font-bold text-blue-600">
              {currency(data.recurring_invoices
                .filter(ri => ri.status === 'active' && ri.frequency === 'monthly')
                .reduce((sum, ri) => sum + ri.amount_cents, 0)
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="text-sm text-gray-600">Due Today</div>
            <div className="text-2xl font-bold text-orange-600">
              {today ? data.recurring_invoices.filter(ri =>
                ri.status === 'active' &&
                ri.next_invoice_date <= today
              ).length : 0}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Recurring Invoices List */}
      <div className="bg-white rounded-xl border shadow-sm">
        {data?.recurring_invoices && data.recurring_invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client & Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount & Frequency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stats
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recurring_invoices.map((recurringInvoice) => (
                  <tr key={recurringInvoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <div className="font-medium text-gray-900">{recurringInvoice.title}</div>
                        <Link
                          href={`/dashboard/clients/${recurringInvoice.clients.id}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          {recurringInvoice.clients.name}
                        </Link>
                        {recurringInvoice.description && (
                          <div className="text-sm text-gray-500 mt-1">{recurringInvoice.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-lg">{currency(recurringInvoice.amount_cents)}</div>
                      <div className="text-sm text-gray-500">{getFrequencyText(recurringInvoice.frequency)}</div>
                      {recurringInvoice.day_of_month && (
                        <div className="text-xs text-gray-400">Day {recurringInvoice.day_of_month} of month</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div><strong>Next:</strong> {prettyDate(recurringInvoice.next_invoice_date)}</div>
                        <div><strong>Started:</strong> {prettyDate(recurringInvoice.start_date)}</div>
                        {recurringInvoice.end_date && (
                          <div><strong>Ends:</strong> {prettyDate(recurringInvoice.end_date)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(recurringInvoice.status)}`}>
                        {recurringInvoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div><strong>{recurringInvoice.total_invoices_sent}</strong> sent</div>
                        {recurringInvoice.last_invoice_sent_at && (
                          <div className="text-gray-500">Last: {prettyDate(recurringInvoice.last_invoice_sent_at)}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedInvoice(recurringInvoice);
                            setShowEditModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Edit
                        </button>
                        {recurringInvoice.status === 'active' && (
                          <button
                            onClick={() => updateStatus(recurringInvoice.id, 'paused')}
                            disabled={actionLoading === recurringInvoice.id}
                            className="text-yellow-600 hover:text-yellow-800 text-sm disabled:opacity-50"
                          >
                            {actionLoading === recurringInvoice.id ? 'Loading...' : 'Pause'}
                          </button>
                        )}
                        {recurringInvoice.status === 'paused' && (
                          <button
                            onClick={() => updateStatus(recurringInvoice.id, 'active')}
                            disabled={actionLoading === recurringInvoice.id}
                            className="text-green-600 hover:text-green-800 text-sm disabled:opacity-50"
                          >
                            {actionLoading === recurringInvoice.id ? 'Loading...' : 'Resume'}
                          </button>
                        )}
                        {recurringInvoice.status !== 'cancelled' && (
                          <button
                            onClick={() => updateStatus(recurringInvoice.id, 'cancelled')}
                            disabled={actionLoading === recurringInvoice.id}
                            className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                          >
                            {actionLoading === recurringInvoice.id ? 'Loading...' : 'Cancel'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg mb-2">No recurring invoices found</p>
            <p className="text-sm">Set up automated billing for hosting and maintenance fees.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              Create Your First Recurring Invoice
            </button>
          </div>
        )}
      </div>

      {/* Activity Log */}
      <div className="bg-white rounded-xl border shadow-sm">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span className="font-medium text-gray-900">Activity Log</span>
          </div>
          <svg className={`w-5 h-5 text-gray-400 transition-transform ${showLogs ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showLogs && (
          <div className="border-t">
            <div className="p-4 border-b bg-gray-50 flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700">Filter:</label>
              <select
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Events</option>
                <option value="processing_started">Processing Started</option>
                <option value="processing_completed">Processing Completed</option>
                <option value="invoice_created">Invoice Created</option>
                <option value="email_sent">Email Sent</option>
                <option value="email_failed">Email Failed</option>
                <option value="stripe_link_created">Stripe Link Created</option>
                <option value="stripe_link_failed">Stripe Link Failed</option>
                <option value="skipped">Skipped</option>
                <option value="error">Error</option>
                <option value="completed">Completed</option>
              </select>
              <button
                onClick={() => mutateLogs()}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {logsData?.logs && logsData.logs.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {logsData.logs.map((logEntry) => (
                    <div key={logEntry.id} className="px-4 py-3 flex items-start gap-3 hover:bg-gray-50">
                      <div className="mt-0.5">
                        <LogStatusIcon status={logEntry.status} eventType={logEntry.event_type} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <LogEventBadge eventType={logEntry.event_type} />
                          <span className="text-xs text-gray-400">
                            {new Date(logEntry.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mt-0.5">{logEntry.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No activity logs yet. Process invoices to see events here.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modals */}
      {showCreateModal && (
        <CreateRecurringInvoiceModal
          today={today}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            mutate(`/api/recurring-invoices?status=${statusFilter}`);
            setShowCreateModal(false);
          }}
        />
      )}

      {showEditModal && selectedInvoice && (
        <EditRecurringInvoiceModal 
          recurringInvoice={selectedInvoice}
          onClose={() => {
            setShowEditModal(false);
            setSelectedInvoice(null);
          }}
          onSuccess={() => {
            mutate(`/api/recurring-invoices?status=${statusFilter}`);
            setShowEditModal(false);
            setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}

// Create Recurring Invoice Modal Component
function CreateRecurringInvoiceModal({ today, onClose, onSuccess }: { today: string; onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState([
    { description: 'Website Hosting', amount_cents: 5000 },
    { description: 'SSL Certificate', amount_cents: 1500 },
    { description: 'Security Monitoring', amount_cents: 3500 }
  ]);

  // Fetch clients on modal open
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const response = await fetch('/api/clients');
        const data = await response.json();
        setClients(data.clients || []);
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      }
    };
    fetchClients();
  }, []);

  const addLineItem = () => {
    setLineItems([...lineItems, { description: '', amount_cents: 0 }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: string, value: any) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    setLineItems(updated);
  };

  const calculateTotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.amount_cents || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const recurringInvoiceData = {
      client_id: formData.get('client_id'),
      title: formData.get('title'),
      description: formData.get('description'),
      line_items: lineItems.filter(item => item.description && item.amount_cents > 0),
      amount_cents: calculateTotal(),
      frequency: formData.get('frequency'),
      start_date: formData.get('start_date'),
      end_date: formData.get('end_date') || null,
      day_of_month: formData.get('frequency') === 'monthly' ? parseInt(formData.get('day_of_month') as string) : null,
      payment_terms: formData.get('payment_terms'),
      require_signature: formData.get('require_signature') === 'on'
    };

    try {
      const response = await fetch('/api/recurring-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recurringInvoiceData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create recurring invoice');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to create recurring invoice:', error);
      alert(`Failed to create recurring invoice: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Create Recurring Invoice</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Client Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client <span className="text-red-500">*</span>
                </label>
                <select
                  name="client_id"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Invoice Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  defaultValue="Monthly Hosting & Maintenance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Monthly hosting, SSL certificate, security monitoring, and website maintenance"
                />
              </div>

              {/* Frequency */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency <span className="text-red-500">*</span>
                </label>
                <select
                  name="frequency"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="monthly">Monthly</option>
                  <option value="weekly">Weekly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>

              {/* Day of Month (for monthly) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Day of Month (for monthly billing)
                </label>
                <input
                  type="number"
                  name="day_of_month"
                  min="1"
                  max="31"
                  defaultValue="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="1st of each month"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    name="start_date"
                    defaultValue={today}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    name="end_date"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Payment Terms */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Terms
                </label>
                <select
                  name="payment_terms"
                  defaultValue="30"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="0">Due on receipt</option>
                  <option value="7">Net 7</option>
                  <option value="14">Net 14</option>
                  <option value="30">Net 30</option>
                </select>
              </div>

              {/* Require Signature */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="require_signature"
                  id="require_signature"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="require_signature" className="ml-2 text-sm text-gray-700">
                  Require client signature
                </label>
              </div>
            </div>

            {/* Right Column - Line Items */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-medium text-gray-900">Line Items</h4>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Item
                </button>
              </div>

              <div className="space-y-3">
                {lineItems.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <div className="flex-1">
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Item description"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="w-32">
                      <input
                        type="number"
                        value={item.amount_cents / 100}
                        onChange={(e) => updateLineItem(index, 'amount_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                        placeholder="0.00"
                        step="0.01"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLineItem(index)}
                      className="text-red-600 hover:text-red-800 p-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Total:</span>
                  <span className="text-xl font-bold text-gray-900">{currency(calculateTotal())}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Recurring Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Modal (simplified version)
function EditRecurringInvoiceModal({ 
  recurringInvoice, 
  onClose, 
  onSuccess 
}: { 
  recurringInvoice: RecurringInvoice; 
  onClose: () => void; 
  onSuccess: () => void; 
}) {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    
    const updateData = {
      id: recurringInvoice.id,
      title: formData.get('title'),
      description: formData.get('description'),
      frequency: formData.get('frequency'),
      day_of_month: formData.get('frequency') === 'monthly' ? parseInt(formData.get('day_of_month') as string) : null,
      start_date: formData.get('start_date'),
      next_invoice_date: formData.get('next_invoice_date'),
      end_date: formData.get('end_date') || null,
      status: formData.get('status'),
      payment_terms: formData.get('payment_terms'),
      amount_cents: parseInt(formData.get('amount_cents') as string) * 100, // Convert dollars to cents
      require_signature: formData.get('require_signature') === 'on'
    };

    try {
      const response = await fetch('/api/recurring-invoices', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update recurring invoice');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Failed to update recurring invoice:', error);
      alert(`Failed to update recurring invoice: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Edit Recurring Invoice</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <input
                  type="text"
                  name="title"
                  defaultValue={recurringInvoice.title}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  defaultValue={recurringInvoice.status}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                name="description"
                defaultValue={recurringInvoice.description}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                <select
                  name="frequency"
                  defaultValue={recurringInvoice.frequency}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                <input
                  type="number"
                  name="day_of_month"
                  min="1"
                  max="31"
                  defaultValue={recurringInvoice.day_of_month || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount (USD)</label>
              <input
                type="number"
                name="amount_cents"
                step="0.01"
                min="0"
                defaultValue={(recurringInvoice.amount_cents / 100).toString()}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="date"
                  name="start_date"
                  defaultValue={recurringInvoice.start_date}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Next Invoice Date</label>
                <input
                  type="date"
                  name="next_invoice_date"
                  defaultValue={recurringInvoice.next_invoice_date}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (Optional)</label>
                <input
                  type="date"
                  name="end_date"
                  defaultValue={recurringInvoice.end_date || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
              <select
                name="payment_terms"
                defaultValue={recurringInvoice.payment_terms || '30'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="0">Due on receipt</option>
                <option value="7">Net 7</option>
                <option value="14">Net 14</option>
                <option value="30">Net 30</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                name="require_signature"
                id="edit_require_signature"
                defaultChecked={recurringInvoice.require_signature}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="edit_require_signature" className="ml-2 text-sm text-gray-700">
                Require client signature
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Recurring Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LogStatusIcon({ status, eventType }: { status: string; eventType: string }) {
  if (status === 'failed' || eventType === 'error') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100">
        <svg className="w-3.5 h-3.5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  if (status === 'skipped') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-yellow-100">
        <svg className="w-3.5 h-3.5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01" />
        </svg>
      </span>
    );
  }
  if (status === 'success') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100">
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100">
      <svg className="w-3.5 h-3.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  );
}

function LogEventBadge({ eventType }: { eventType: string }) {
  const styles: Record<string, string> = {
    processing_started: 'bg-blue-100 text-blue-800',
    processing_completed: 'bg-blue-100 text-blue-800',
    invoice_created: 'bg-green-100 text-green-800',
    email_sent: 'bg-green-100 text-green-800',
    email_failed: 'bg-red-100 text-red-800',
    stripe_link_created: 'bg-purple-100 text-purple-800',
    stripe_link_failed: 'bg-red-100 text-red-800',
    payment_received: 'bg-emerald-100 text-emerald-800',
    payment_failed: 'bg-red-100 text-red-800',
    invoice_opened: 'bg-indigo-100 text-indigo-800',
    skipped: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
  };

  const labels: Record<string, string> = {
    processing_started: 'Processing Started',
    processing_completed: 'Processing Complete',
    invoice_created: 'Invoice Created',
    email_sent: 'Email Sent',
    email_failed: 'Email Failed',
    stripe_link_created: 'Stripe Link',
    stripe_link_failed: 'Stripe Failed',
    payment_received: 'Payment Received',
    payment_failed: 'Payment Failed',
    invoice_opened: 'Invoice Opened',
    skipped: 'Skipped',
    completed: 'Completed',
    error: 'Error',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${styles[eventType] || 'bg-gray-100 text-gray-800'}`}>
      {labels[eventType] || eventType}
    </span>
  );
}