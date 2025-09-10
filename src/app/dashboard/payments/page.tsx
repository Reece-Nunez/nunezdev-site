'use client';

import { useState, useEffect } from 'react';
import useSWR, { mutate } from 'swr';
import Link from 'next/link';
import { currency, prettyDate } from '@/lib/ui';

interface Payment {
  id: string;
  amount_cents: number;
  paid_at: string;
  payment_method?: string;
  stripe_payment_intent_id?: string;
  metadata?: any;
  invoice: {
    id: string;
    description?: string;
    invoice_number?: string;
    client: {
      id: string;
      name: string;
    };
  };
}

interface PaymentsData {
  payments: Payment[];
  summary: {
    totalAmount: number;
    paymentCount: number;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function PaymentsPage() {
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'client'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterBy, setFilterBy] = useState<'all' | 'manual' | 'stripe' | 'cash'>('all');
  const [clientFilter, setClientFilter] = useState<string>('');
  
  // Action states
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string>('');

  const { data, error, isLoading } = useSWR<PaymentsData>(`/api/payments?sort=${sortBy}&order=${sortOrder}&filter=${filterBy}&client=${clientFilter}`, fetcher);

  const handleSort = (field: 'date' | 'amount' | 'client') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const uniqueClients = data?.payments ? 
    Array.from(new Set(data.payments.map(p => p.invoice.client.name))).sort() : [];

  // Action handlers
  const openDeleteModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDeleteModal(true);
  };

  const openEditModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowEditModal(true);
  };

  const openDetailsModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowDetailsModal(true);
  };

  const openAddNoteModal = (payment: Payment) => {
    setSelectedPayment(payment);
    setShowAddNoteModal(true);
  };

  const closeModals = () => {
    setSelectedPayment(null);
    setShowDeleteModal(false);
    setShowEditModal(false);
    setShowDetailsModal(false);
    setShowAddNoteModal(false);
    setShowAddPaymentModal(false);
  };

  const deletePayment = async (paymentId: string) => {
    setActionLoading(paymentId);
    try {
      const response = await fetch(`/api/payments/${paymentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Delete failed');
      
      // Refresh data
      mutate(`/api/payments?sort=${sortBy}&order=${sortOrder}&filter=${filterBy}&client=${clientFilter}`);
      closeModals();
    } catch (error) {
      alert('Failed to delete payment');
    } finally {
      setActionLoading('');
    }
  };

  const duplicatePayment = async (payment: Payment) => {
    setActionLoading(payment.id);
    try {
      const duplicateData = {
        invoice_id: payment.invoice.id,
        amount_cents: payment.amount_cents,
        payment_method: payment.payment_method,
        paid_at: new Date().toISOString(),
        metadata: {
          ...payment.metadata,
          duplicated_from: payment.id,
          duplicated_at: new Date().toISOString()
        }
      };

      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateData)
      });

      if (!response.ok) throw new Error('Duplicate failed');
      
      // Refresh data
      mutate(`/api/payments?sort=${sortBy}&order=${sortOrder}&filter=${filterBy}&client=${clientFilter}`);
    } catch (error) {
      alert('Failed to duplicate payment');
    } finally {
      setActionLoading('');
    }
  };

  const exportPayment = (payment: Payment) => {
    const csvData = [
      ['Payment ID', 'Date', 'Amount', 'Client', 'Invoice', 'Method', 'Details'],
      [
        payment.id,
        new Date(payment.paid_at).toLocaleDateString(),
        (payment.amount_cents / 100).toString(),
        payment.invoice.client.name,
        payment.invoice.invoice_number || '',
        payment.payment_method || '',
        payment.metadata?.description || ''
      ]
    ].map(row => row.join(',')).join('\\n');

    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-${payment.id}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) return <div className="p-6 my-36">Loading payments...</div>;
  if (error) return <div className="p-6 my-36 text-red-600">Failed to load payments</div>;

  return (
    <div className="p-3 sm:p-6 max-w-7xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Payments</h1>
          <p className="text-gray-600">Track all payments across clients and deals</p>
        </div>
        <button
          onClick={() => setShowAddPaymentModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add Manual Payment
        </button>
      </div>

      {/* Summary Cards */}
      {data?.summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="text-sm text-gray-600">Total Payments</div>
            <div className="text-2xl font-bold text-green-600">{currency(data.summary.totalAmount)}</div>
          </div>
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="text-sm text-gray-600">Payment Count</div>
            <div className="text-2xl font-bold">{data.summary.paymentCount}</div>
          </div>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="bg-white rounded-xl border shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Method</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as typeof filterBy)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Methods</option>
              <option value="manual">Manual</option>
              <option value="stripe">Stripe</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Client</label>
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="">All Clients</option>
              {uniqueClients.map((client) => (
                <option key={client} value={client}>{client}</option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-') as [typeof sortBy, typeof sortOrder];
                setSortBy(field);
                setSortOrder(order);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
            >
              <option value="date-desc">Date (Newest First)</option>
              <option value="date-asc">Date (Oldest First)</option>
              <option value="amount-desc">Amount (High to Low)</option>
              <option value="amount-asc">Amount (Low to High)</option>
              <option value="client-asc">Client (A-Z)</option>
              <option value="client-desc">Client (Z-A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {data?.payments && data.payments.length > 0 ? (
          <>
            {/* Mobile Card View */}
            <div className="block sm:hidden">
              {data.payments.map((payment) => (
                <div key={payment.id} className="border-b border-gray-200 last:border-b-0 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="font-medium text-lg text-gray-900">
                        {currency(payment.amount_cents)}
                      </div>
                      <Link 
                        href={`/clients/${payment.invoice.client.id}`}
                        className="text-blue-600 hover:underline text-sm"
                      >
                        {payment.invoice.client.name}
                      </Link>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500 mb-1">
                        {prettyDate(payment.paid_at)}
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        payment.payment_method === 'Manual' || payment.payment_method === 'Cash' 
                          ? 'bg-gray-100 text-gray-800'
                          : payment.stripe_payment_intent_id
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {payment.payment_method || 'Manual'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <div className="text-sm text-gray-600">
                      {payment.invoice.invoice_number && (
                        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded mr-2">
                          #{payment.invoice.invoice_number}
                        </span>
                      )}
                      <span>{payment.invoice.description || 'No description'}</span>
                    </div>
                    {(payment.metadata?.description || payment.metadata?.notes) && (
                      <div className="text-xs text-gray-500 mt-1">
                        {payment.metadata?.description || payment.metadata?.notes}
                      </div>
                    )}
                  </div>
                  
                  {/* Mobile Actions */}
                  <div className="flex items-center justify-center space-x-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => openDetailsModal(payment)}
                      className="text-blue-600 hover:text-blue-900 text-xs flex flex-col items-center"
                    >
                      <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      View
                    </button>
                    <button
                      onClick={() => openEditModal(payment)}
                      className="text-gray-600 hover:text-gray-900 text-xs flex flex-col items-center"
                    >
                      <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => duplicatePayment(payment)}
                      disabled={actionLoading === payment.id}
                      className="text-green-600 hover:text-green-900 disabled:opacity-50 text-xs flex flex-col items-center"
                    >
                      {actionLoading === payment.id ? (
                        <svg className="animate-spin w-4 h-4 mb-1" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                      Copy
                    </button>
                    <button
                      onClick={() => exportPayment(payment)}
                      className="text-purple-600 hover:text-purple-900 text-xs flex flex-col items-center"
                    >
                      <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Export
                    </button>
                    <button
                      onClick={() => openDeleteModal(payment)}
                      className="text-red-600 hover:text-red-900 text-xs flex flex-col items-center"
                    >
                      <svg className="w-4 h-4 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="w-20 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('amount')}
                  >
                    Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('client')}
                  >
                    Client {sortBy === 'client' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="w-32 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice
                  </th>
                  <th className="w-20 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="w-24 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Details
                  </th>
                  <th className="w-32 px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.payments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3 text-sm font-medium text-gray-900">
                      {currency(payment.amount_cents)}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <Link 
                        href={`/clients/${payment.invoice.client.id}`}
                        className="text-blue-600 hover:underline truncate block"
                        title={payment.invoice.client.name}
                      >
                        {payment.invoice.client.name}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <div>
                        {payment.invoice.invoice_number && (
                          <div className="font-mono text-xs text-gray-500 truncate">
                            #{payment.invoice.invoice_number}
                          </div>
                        )}
                        <div className="text-xs truncate" title={payment.invoice.description || ''}>
                          {payment.invoice.description || 'No description'}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900">
                      <span className={`inline-flex px-1 py-1 text-xs font-semibold rounded ${
                        payment.payment_method === 'Manual' || payment.payment_method === 'Cash' 
                          ? 'bg-gray-100 text-gray-800'
                          : payment.stripe_payment_intent_id
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {(payment.payment_method || 'Manual').substring(0, 6)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      <div className="truncate" title={payment.metadata?.description || payment.metadata?.notes || ''}>
                        {payment.metadata?.description || payment.metadata?.notes || '—'}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => openDetailsModal(payment)}
                          className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 flex flex-col items-center"
                          title="View Details"
                        >
                          <svg className="w-3 h-3 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="text-xs">View</span>
                        </button>
                        <button
                          onClick={() => openEditModal(payment)}
                          className="text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-50 flex flex-col items-center"
                          title="Edit Payment"
                        >
                          <svg className="w-3 h-3 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          <span className="text-xs">Edit</span>
                        </button>
                        <button
                          onClick={() => duplicatePayment(payment)}
                          disabled={actionLoading === payment.id}
                          className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50 disabled:opacity-50 flex flex-col items-center"
                          title="Duplicate Payment"
                        >
                          {actionLoading === payment.id ? (
                            <svg className="animate-spin w-3 h-3 mb-1" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            <svg className="w-3 h-3 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          )}
                          <span className="text-xs">Copy</span>
                        </button>
                        <button
                          onClick={() => exportPayment(payment)}
                          className="text-purple-600 hover:text-purple-900 p-1 rounded hover:bg-purple-50 flex flex-col items-center"
                          title="Export to CSV"
                        >
                          <svg className="w-3 h-3 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span className="text-xs">Export</span>
                        </button>
                        <button
                          onClick={() => openDeleteModal(payment)}
                          className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 flex flex-col items-center"
                          title="Delete Payment"
                        >
                          <svg className="w-3 h-3 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          <span className="text-xs">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <p>No payments found.</p>
            <p className="text-sm">Payments will appear here once clients start paying invoices.</p>
          </div>
        )}
      </div>

      {/* Modal Components */}
      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this payment of <strong>{currency(selectedPayment.amount_cents)}</strong> for <strong>{selectedPayment.invoice.client.name}</strong>?
            </p>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3">
              <button
                onClick={closeModals}
                className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deletePayment(selectedPayment.id)}
                disabled={actionLoading === selectedPayment.id}
                className="w-full sm:w-auto px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading === selectedPayment.id ? 'Deleting...' : 'Delete Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {showDetailsModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Payment Details</h3>
              <button onClick={closeModals} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment ID</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedPayment.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <p className="text-sm text-gray-900 font-bold">{currency(selectedPayment.amount_cents)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paid Date</label>
                  <p className="text-sm text-gray-900">{prettyDate(selectedPayment.paid_at)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <p className="text-sm text-gray-900">{selectedPayment.payment_method || 'Manual'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
                <p className="text-sm text-gray-900">{selectedPayment.invoice.client.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
                <p className="text-sm text-gray-900">
                  {selectedPayment.invoice.invoice_number && `#${selectedPayment.invoice.invoice_number} - `}
                  {selectedPayment.invoice.description || 'No description'}
                </p>
              </div>
              {selectedPayment.stripe_payment_intent_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stripe Payment Intent</label>
                  <p className="text-sm text-gray-900 font-mono">{selectedPayment.stripe_payment_intent_id}</p>
                </div>
              )}
              {selectedPayment.metadata && Object.keys(selectedPayment.metadata).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metadata</label>
                  <pre className="text-sm text-gray-900 bg-gray-50 p-2 rounded border overflow-x-auto">
                    {JSON.stringify(selectedPayment.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button
                onClick={closeModals}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Payment Modal */}
      {showEditModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Edit Payment</h3>
              <button onClick={closeModals} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!selectedPayment) return;
              
              const formData = new FormData(e.target as HTMLFormElement);
              const amount = parseFloat(formData.get('amount') as string);
              const paymentMethod = formData.get('payment_method') as string;
              const notes = formData.get('notes') as string;
              const paidAt = formData.get('paid_at') as string;
              
              if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid amount');
                return;
              }
              
              setActionLoading(selectedPayment.id);
              try {
                const response = await fetch(`/api/payments/${selectedPayment.id}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    amount_cents: Math.round(amount * 100),
                    payment_method: paymentMethod,
                    notes: notes,
                    paid_at: paidAt
                  })
                });
                
                if (!response.ok) throw new Error('Update failed');
                
                // Refresh data
                mutate(`/api/payments?sort=${sortBy}&order=${sortOrder}&filter=${filterBy}&client=${clientFilter}`);
                closeModals();
                alert('Payment updated successfully');
              } catch (error) {
                alert('Failed to update payment');
              } finally {
                setActionLoading('');
              }
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={(selectedPayment.amount_cents / 100).toFixed(2)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                  <input
                    name="paid_at"
                    type="date"
                    defaultValue={new Date(selectedPayment.paid_at).toISOString().split('T')[0]}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    name="payment_method"
                    defaultValue={selectedPayment.payment_method || 'Manual'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Cash">Cash</option>
                    <option value="Check">Check</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    name="notes"
                    defaultValue={selectedPayment.metadata?.notes || selectedPayment.metadata?.description || ''}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Add notes about this payment..."
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModals}
                  className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Note Modal */}
      {showAddNoteModal && selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <div className="flex justify-between items-start mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Add Note</h3>
              <button onClick={closeModals} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={(e) => {
              e.preventDefault();
              // TODO: Implement add note functionality
              alert('Add note functionality to be implemented');
              closeModals();
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Notes</label>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border">
                    {selectedPayment.metadata?.notes || selectedPayment.metadata?.description || 'No notes'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add New Note</label>
                  <textarea
                    placeholder="Enter additional notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={4}
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModals}
                  className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Manual Payment Modal */}
      {showAddPaymentModal && (
        <AddManualPaymentModal 
          onClose={closeModals}
          onSuccess={() => {
            mutate(`/api/payments?sort=${sortBy}&order=${sortOrder}&filter=${filterBy}&client=${clientFilter}`);
            closeModals();
          }}
        />
      )}
    </div>
  );
}

// Add Manual Payment Modal Component
function AddManualPaymentModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState('');
  const [loadingInvoices, setLoadingInvoices] = useState(false);

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

  // Fetch invoices when client is selected
  useEffect(() => {
    if (selectedClient) {
      const fetchInvoices = async () => {
        setLoadingInvoices(true);
        try {
          // Fetch all invoices for the client and filter on frontend
          const response = await fetch(`/api/invoices?client_id=${selectedClient}`);
          const data = await response.json();
          
          // Filter for unpaid invoices (sent, partially_paid, overdue, draft)
          const unpaidInvoices = (data.invoices || []).filter((invoice: any) => 
            ['sent', 'partially_paid', 'overdue', 'draft'].includes(invoice.status)
          );
          
          setInvoices(unpaidInvoices);
        } catch (error) {
          console.error('Failed to fetch invoices:', error);
          setInvoices([]);
        } finally {
          setLoadingInvoices(false);
        }
      };
      fetchInvoices();
    } else {
      setInvoices([]);
      setSelectedInvoice('');
    }
  }, [selectedClient]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const amount = parseFloat(formData.get('amount') as string);
    const paymentMethod = formData.get('payment_method') as string;
    const paymentDate = formData.get('payment_date') as string;
    const notes = formData.get('notes') as string;

    if (!amount || amount <= 0) {
      alert('Please enter a valid payment amount');
      setLoading(false);
      return;
    }

    if (!selectedInvoice) {
      alert('Please select an invoice');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: selectedInvoice,
          amount_cents: Math.round(amount * 100),
          payment_method: paymentMethod,
          paid_at: paymentDate,
          notes: notes,
          manual: true
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Payment creation failed:', error);
      alert(`Failed to create payment: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedInvoiceData = invoices.find(inv => inv.id === selectedInvoice);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6">
          <h3 className="text-xl font-semibold text-gray-900">Add Manual Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Client Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
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

            {/* Invoice Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Invoice <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedInvoice}
                onChange={(e) => setSelectedInvoice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
                disabled={!selectedClient || loadingInvoices}
              >
                <option value="">
                  {!selectedClient ? 'Select a client first...' : 
                   loadingInvoices ? 'Loading invoices...' : 
                   'Select an invoice...'}
                </option>
                {invoices.map(invoice => (
                  <option key={invoice.id} value={invoice.id}>
                    {invoice.invoice_number} - ${((invoice.remaining_balance_cents || invoice.amount_cents) / 100).toFixed(2)} due
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice Details */}
            {selectedInvoiceData && (
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Invoice:</strong> {selectedInvoiceData.invoice_number}<br/>
                  <strong>Total Amount:</strong> ${(selectedInvoiceData.amount_cents / 100).toFixed(2)}<br/>
                  <strong>Paid So Far:</strong> ${((selectedInvoiceData.total_paid_cents || 0) / 100).toFixed(2)}<br/>
                  <strong>Remaining Balance:</strong> ${((selectedInvoiceData.remaining_balance_cents || selectedInvoiceData.amount_cents) / 100).toFixed(2)}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  min="0.01"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              {/* Payment Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="payment_date"
                  defaultValue={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                name="payment_method"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="CashApp">CashApp</option>
                <option value="Venmo">Venmo</option>
                <option value="Zelle">Zelle</option>
                <option value="Cash">Cash</option>
                <option value="Check">Check</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="PayPal">PayPal</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                name="notes"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Add any notes about this payment (transaction ID, reference number, etc.)"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating Payment...' : 'Create Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}