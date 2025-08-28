'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import { stageToProgress, currency } from '@/lib/progress';

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
}

interface Deal {
  id: string;
  title: string;
  stage: string;
  value_cents: number;
  probability: number;
  expected_close_date?: string;
  description?: string;
  created_at: string;
  updated_at?: string;
  source?: string;
  hubspot_deal_id?: string;
  client?: Client;
}

interface Payment {
  id: string;
  amount_cents: number;
  paid_at: string;
  payment_method?: string;
  stripe_payment_intent_id?: string;
  notes?: string;
}

interface Invoice {
  id: string;
  status: string;
  amount_cents: number;
  issued_at?: string;
  due_at?: string;
  description?: string;
  created_at: string;
  invoice_payments: Payment[];
}

interface DealData {
  deal: Deal;
  invoices: Invoice[];
  notes: any[];
  tasks: any[];
  financials: {
    totalInvoiced: number;
    totalPaid: number;
    balanceDue: number;
  };
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const stages = [
  'Contacted',
  'Negotiation', 
  'Contract Sent',
  'Contract Signed',
  'Won',
  'Lost',
  'Abandoned'
];

function getStageColor(stage: string) {
  const colors = {
    'Contacted': 'bg-blue-100 text-blue-800',
    'Negotiation': 'bg-yellow-100 text-yellow-800',
    'Contract Sent': 'bg-orange-100 text-orange-800',
    'Contract Signed': 'bg-purple-100 text-purple-800',
    'Won': 'bg-green-100 text-green-800',
    'Lost': 'bg-red-100 text-red-800',
    'Abandoned': 'bg-gray-100 text-gray-800',
  };
  return colors[stage as keyof typeof colors] || 'bg-gray-100 text-gray-800';
}

export default function DealDetailPage() {
  const params = useParams();
  const router = useRouter();
  const dealId = params.id as string;
  
  const { data, error, isLoading } = useSWR<DealData>(`/api/deals/${dealId}`, fetcher);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Deal>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  // Modal states
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Form states
  const [invoiceForm, setInvoiceForm] = useState({
    amount_cents: 0,
    description: '',
    due_days: 30
  });
  
  const [paymentForm, setPaymentForm] = useState({
    invoice_id: '',
    amount_cents: 0,
    payment_method: 'Manual',
    notes: '',
    paid_at: new Date().toISOString().split('T')[0]
  });
  
  // Stripe payment link states
  const [showStripeModal, setShowStripeModal] = useState(false);
  const [stripeForm, setStripeForm] = useState({
    amount_cents: 0,
    description: ''
  });
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    if (data?.deal) {
      setEditForm({
        title: data.deal.title,
        stage: data.deal.stage,
        value_cents: data.deal.value_cents,
        probability: data.deal.probability,
        expected_close_date: data.deal.expected_close_date?.split('T')[0],
        description: data.deal.description
      });
      
      // Initialize invoice form with deal value
      setInvoiceForm({
        amount_cents: data.deal.value_cents,
        description: `Invoice for ${data.deal.title}`,
        due_days: 30
      });
      
      // Initialize stripe form with deal value
      setStripeForm({
        amount_cents: data.deal.value_cents,
        description: `Payment for ${data.deal.title}`
      });
    }
  }, [data]);

  const createInvoice = async () => {
    try {
      const response = await fetch(`/api/deals/${dealId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceForm)
      });

      if (response.ok) {
        setShowInvoiceModal(false);
        mutate(`/api/deals/${dealId}`);
        alert('Invoice created successfully!');
      } else {
        const error = await response.json();
        alert(`Failed to create invoice: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to create invoice');
    }
  };

  const addPayment = async () => {
    try {
      const response = await fetch(`/api/deals/${dealId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...paymentForm,
          paid_at: paymentForm.paid_at + 'T00:00:00.000Z'
        })
      });

      if (response.ok) {
        const result = await response.json();
        setShowPaymentModal(false);
        mutate(`/api/deals/${dealId}`);
        
        let message = 'Payment added successfully!';
        if (result.auto_updated_stage) {
          message += ` ${result.auto_updated_stage}`;
        }
        alert(message);
        
        // Reset form
        setPaymentForm({
          invoice_id: '',
          amount_cents: 0,
          payment_method: 'Manual',
          notes: '',
          paid_at: new Date().toISOString().split('T')[0]
        });
      } else {
        const error = await response.json();
        alert(`Failed to add payment: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to add payment');
    }
  };

  const createStripeLink = async () => {
    setStripeLoading(true);
    try {
      const response = await fetch(`/api/deals/${dealId}/stripe-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_cents: stripeForm.amount_cents,
          description: stripeForm.description,
          success_url: `${window.location.origin}/deals/${dealId}?payment=success`,
          cancel_url: `${window.location.origin}/deals/${dealId}?payment=cancelled`
        })
      });

      if (response.ok) {
        const result = await response.json();
        setShowStripeModal(false);
        
        // Open the payment link in a new tab
        window.open(result.payment_link, '_blank');
        
        alert('Stripe payment link created! Check your new tab to complete the payment.');
        mutate(`/api/deals/${dealId}`);
      } else {
        const error = await response.json();
        alert(`Failed to create payment link: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to create payment link');
    } finally {
      setStripeLoading(false);
    }
  };

  const saveDeal = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        setIsEditing(false);
        mutate(`/api/deals/${dealId}`);
      } else {
        const error = await response.json();
        alert(`Failed to save: ${error.error}`);
      }
    } catch (err) {
      alert('Failed to save deal');
    } finally {
      setIsSaving(false);
    }
  };

  const deleteDeal = async () => {
    if (!confirm('Are you sure you want to delete this deal?')) return;
    
    try {
      const response = await fetch(`/api/deals/${dealId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        router.push('/dashboard/deals');
      } else {
        alert('Failed to delete deal');
      }
    } catch (err) {
      alert('Failed to delete deal');
    }
  };

  if (isLoading) return <div className="p-6 my-36">Loading deal...</div>;
  if (error || !data || !data.deal) return <div className="p-6 my-36 text-red-600">Failed to load deal</div>;

  const { deal, invoices, financials } = data;

  return (
    <div className="p-6 max-w-6xl mx-auto my-36 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/deals" className="text-blue-600 hover:underline text-sm">
            ← Back to Deals
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{deal.title}</h1>
          <p className="text-gray-600">Deal Details & Management</p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Edit Deal
              </button>
              <button
                onClick={deleteDeal}
                className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Delete
              </button>
            </>
          ) : (
            <>
              <button
                onClick={saveDeal}
                disabled={isSaving}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Deal Information */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Deal Information</h2>
            
            {!isEditing ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Title</label>
                  <p className="text-lg">{deal.title}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Stage</label>
                    <div className="mt-1">
                      <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${getStageColor(deal.stage)}`}>
                        {deal.stage}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Progress</label>
                    <div className="mt-2 h-2 w-full rounded bg-gray-100">
                      <div
                        className="h-2 rounded bg-emerald-500"
                        style={{ width: `${stageToProgress(deal.stage)}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Value</label>
                    <p className="text-lg font-medium">{currency(deal.value_cents)}</p>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-600">Probability</label>
                    <p className="text-lg">{deal.probability}%</p>
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Expected Close Date</label>
                  <p>{deal.expected_close_date ? new Date(deal.expected_close_date).toLocaleDateString() : '—'}</p>
                </div>
                
                {deal.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Description</label>
                    <p className="whitespace-pre-wrap">{deal.description}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Title</label>
                  <input
                    type="text"
                    value={editForm.title || ''}
                    onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stage</label>
                    <select
                      value={editForm.stage || ''}
                      onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    >
                      {stages.map(stage => (
                        <option key={stage} value={stage}>{stage}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Probability (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.probability || ''}
                      onChange={(e) => setEditForm({ ...editForm, probability: parseInt(e.target.value) })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Value ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={(editForm.value_cents || 0) / 100}
                      onChange={(e) => setEditForm({ ...editForm, value_cents: Math.round(parseFloat(e.target.value) * 100) })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Expected Close Date</label>
                    <input
                      type="date"
                      value={editForm.expected_close_date || ''}
                      onChange={(e) => setEditForm({ ...editForm, expected_close_date: e.target.value })}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <textarea
                    rows={3}
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    placeholder="Add deal description..."
                  />
                </div>
              </div>
            )}
          </div>

          {/* Invoices & Payments */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Invoices & Payments</h2>
              <button 
                onClick={() => setShowInvoiceModal(true)}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 text-sm"
              >
                + Create Invoice
              </button>
            </div>
            
            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-sm text-gray-600">Total Invoiced</div>
                <div className="text-lg font-semibold">{currency(financials.totalInvoiced)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Total Paid</div>
                <div className="text-lg font-semibold text-green-600">{currency(financials.totalPaid)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-600">Balance Due</div>
                <div className="text-lg font-semibold text-red-600">{currency(financials.balanceDue)}</div>
              </div>
            </div>

            {/* Invoice List */}
            {invoices.length > 0 ? (
              <div className="space-y-4">
                {invoices.map((invoice) => (
                  <div key={invoice.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{currency(invoice.amount_cents)}</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          invoice.status === 'overdue' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : 'Draft'}
                      </div>
                    </div>
                    
                    {invoice.description && (
                      <p className="text-sm text-gray-600 mb-2">{invoice.description}</p>
                    )}
                    
                    {invoice.invoice_payments.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-sm font-medium text-gray-700">Payments:</div>
                        {invoice.invoice_payments.map((payment) => (
                          <div key={payment.id} className="text-sm text-gray-600 flex items-center justify-between">
                            <span>{currency(payment.amount_cents)} - {payment.payment_method || 'Manual'}</span>
                            <span>{new Date(payment.paid_at).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No invoices found for this client.</p>
                <p className="text-sm">Create an invoice to start tracking payments.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Information */}
          {deal.client && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="text-lg font-semibold mb-4">Client Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <Link 
                    href={`/clients/${deal.client.id}`}
                    className="block text-blue-600 hover:underline font-medium"
                  >
                    {deal.client.name}
                  </Link>
                </div>
                
                {deal.client.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p className="text-sm">{deal.client.email}</p>
                  </div>
                )}
                
                {deal.client.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Phone</label>
                    <p className="text-sm">{deal.client.phone}</p>
                  </div>
                )}
                
                {deal.client.company && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Company</label>
                    <p className="text-sm">{deal.client.company}</p>
                  </div>
                )}
                
                <div>
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <p className="text-sm">{deal.client.status}</p>
                </div>
              </div>
            </div>
          )}

          {/* Deal Metadata */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Deal Details</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="font-medium text-gray-600">Created</label>
                <p>{new Date(deal.created_at).toLocaleDateString()}</p>
              </div>
              
              {deal.updated_at && (
                <div>
                  <label className="font-medium text-gray-600">Last Updated</label>
                  <p>{new Date(deal.updated_at).toLocaleDateString()}</p>
                </div>
              )}
              
              {deal.source && (
                <div>
                  <label className="font-medium text-gray-600">Source</label>
                  <p>{deal.source}</p>
                </div>
              )}
              
              {deal.hubspot_deal_id && (
                <div>
                  <label className="font-medium text-gray-600">HubSpot ID</label>
                  <p className="font-mono text-xs">{deal.hubspot_deal_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setShowStripeModal(true)}
                className="w-full rounded-lg border border-blue-200 px-3 py-2 text-blue-700 hover:bg-blue-50 text-sm"
              >
                Create Stripe Payment Link
              </button>
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="w-full rounded-lg border border-green-200 px-3 py-2 text-green-700 hover:bg-green-50 text-sm"
              >
                Add Manual Payment
              </button>
              <button className="w-full rounded-lg border border-purple-200 px-3 py-2 text-purple-700 hover:bg-purple-50 text-sm">
                Add Note
              </button>
              <button className="w-full rounded-lg border border-orange-200 px-3 py-2 text-orange-700 hover:bg-orange-50 text-sm">
                Create Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Invoice</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(invoiceForm.amount_cents || 0) / 100}
                  onChange={(e) => setInvoiceForm({
                    ...invoiceForm,
                    amount_cents: Math.round(parseFloat(e.target.value || '0') * 100)
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Invoice description..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due in (days)</label>
                <input
                  type="number"
                  value={invoiceForm.due_days}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, due_days: parseInt(e.target.value) })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createInvoice}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Create Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Add Manual Payment</h3>
            
            <div className="space-y-4">
              {invoices.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice (optional)</label>
                  <select
                    value={paymentForm.invoice_id}
                    onChange={(e) => setPaymentForm({ ...paymentForm, invoice_id: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">Create new invoice for payment</option>
                    {invoices.map(invoice => (
                      <option key={invoice.id} value={invoice.id}>
                        {currency(invoice.amount_cents)} - {invoice.status} - {invoice.description || 'No description'}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(paymentForm.amount_cents || 0) / 100}
                  onChange={(e) => setPaymentForm({
                    ...paymentForm,
                    amount_cents: Math.round(parseFloat(e.target.value || '0') * 100)
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  <option value="Manual">Manual</option>
                  <option value="Cash">Cash</option>
                  <option value="Check">Check</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="PayPal">PayPal</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentForm.paid_at}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  rows={2}
                  placeholder="Payment notes..."
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={addPayment}
                className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Stripe Payment Link Modal */}
      {showStripeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold mb-4">Create Stripe Payment Link</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(stripeForm.amount_cents || 0) / 100}
                  onChange={(e) => setStripeForm({
                    ...stripeForm,
                    amount_cents: Math.round(parseFloat(e.target.value || '0') * 100)
                  })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={stripeForm.description}
                  onChange={(e) => setStripeForm({ ...stripeForm, description: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                  placeholder="Payment description..."
                />
              </div>
              
              {deal.client?.email && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <strong>Client Email:</strong> {deal.client.email}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Payment will be automatically matched to this client when completed.
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setShowStripeModal(false)}
                className="rounded-lg border px-4 py-2 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createStripeLink}
                disabled={stripeLoading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {stripeLoading ? 'Creating...' : 'Create Payment Link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}