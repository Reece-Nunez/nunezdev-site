'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Client {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  amount_cents: number;
  issued_at?: string;
  description?: string;
}

interface DealFormData {
  title: string;
  client_id: string;
  stage: string;
  value_cents: number;
  probability: number;
  expected_close_date: string;
  description: string;
  source: string;
}

const stages = [
  'Contacted',
  'Negotiation', 
  'Contract Sent',
  'Contract Signed'
];

export default function NewDealPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [formData, setFormData] = useState<DealFormData>({
    title: '',
    client_id: '',
    stage: 'Contacted',
    value_cents: 0,
    probability: 25,
    expected_close_date: '',
    description: '',
    source: 'manual'
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load clients on component mount
  useEffect(() => {
    async function loadClients() {
      try {
        const response = await fetch('/api/clients');
        if (response.ok) {
          const data = await response.json();
          setClients(data.clients || []);
        }
      } catch (error) {
        console.error('Failed to load clients:', error);
      }
    }
    loadClients();
  }, []);

  // Load invoices when client is selected
  const loadClientInvoices = async (clientId: string) => {
    if (!clientId) {
      setClientInvoices([]);
      return;
    }

    setLoadingInvoices(true);
    try {
      const response = await fetch(`/api/clients/${clientId}/invoices`);
      if (response.ok) {
        const data = await response.json();
        const invoices = data.invoices || [];
        setClientInvoices(invoices);

        // Auto-suggest deal value based on the most recent unpaid invoice
        const unpaidInvoice = invoices.find((inv: Invoice) => 
          inv.status !== 'paid' && inv.status !== 'void'
        );
        if (unpaidInvoice && formData.value_cents === 0) {
          updateFormData('value_cents', unpaidInvoice.amount_cents);
        }
      }
    } catch (error) {
      console.error('Failed to load client invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Handle client selection change
  const handleClientChange = (clientId: string) => {
    updateFormData('client_id', clientId);
    loadClientInvoices(clientId);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Deal title is required';
    }

    if (!formData.client_id) {
      newErrors.client_id = 'Please select a client';
    }

    if (formData.value_cents < 0) {
      newErrors.value_cents = 'Deal value cannot be negative';
    }

    if (formData.probability < 0 || formData.probability > 100) {
      newErrors.probability = 'Probability must be between 0 and 100';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/deals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/deals/${data.deal.id}`);
      } else {
        const errorData = await response.json();
        setErrors({ submit: errorData.error || 'Failed to create deal' });
      }
    } catch (error) {
      setErrors({ submit: 'Failed to create deal' });
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (field: keyof DealFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto my-36">
      {/* Header */}
      <div className="mb-6">
        <Link href="/dashboard/deals" className="text-blue-600 hover:underline text-sm">
          ← Back to Deals
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Create New Deal</h1>
        <p className="text-gray-600">Add a new sales opportunity to track</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Deal Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData('title', e.target.value)}
                placeholder="e.g., Custom Website Development"
                className={`w-full rounded-lg border px-3 py-2 ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Client *</label>
              <select
                value={formData.client_id}
                onChange={(e) => handleClientChange(e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 ${
                  errors.client_id ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                <option value="">Select a client...</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} {client.company ? `(${client.company})` : ''}
                  </option>
                ))}
              </select>
              {errors.client_id && <p className="text-red-500 text-xs mt-1">{errors.client_id}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateFormData('description', e.target.value)}
              placeholder="Brief description of the deal or project..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        {/* Invoice Information */}
        {formData.client_id && (
          <div className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Related Invoices</h2>
            
            {loadingInvoices ? (
              <div className="text-sm text-gray-500">Loading client invoices...</div>
            ) : clientInvoices.length > 0 ? (
              <div>
                <div className="mb-3">
                  <p className="text-sm text-gray-700 mb-2">
                    This client has {clientInvoices.length} existing invoice(s):
                  </p>
                  <div className="space-y-2">
                    {clientInvoices.slice(0, 3).map((invoice) => (
                      <div key={invoice.id} className="flex justify-between items-center p-2 bg-gray-50 rounded text-sm">
                        <span className="font-medium">
                          {invoice.invoice_number || `Invoice #${invoice.id.slice(-8)}`}
                        </span>
                        <span>${(invoice.amount_cents / 100).toFixed(2)}</span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'sent' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    ))}
                    {clientInvoices.length > 3 && (
                      <p className="text-xs text-gray-500">
                        ...and {clientInvoices.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
                
                {clientInvoices.some(inv => inv.status !== 'paid' && inv.status !== 'void') && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0">
                        <svg className="w-4 h-4 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm text-blue-800 font-medium">Unpaid invoices found</p>
                        <p className="text-sm text-blue-700">
                          This client has {clientInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'void').length} unpaid invoice(s). 
                          Consider setting the deal value to match the invoice amount.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                No invoices found for this client. You can create an invoice after the deal is created.
              </div>
            )}
          </div>
        )}

        {/* Deal Details */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Deal Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Stage</label>
              <select
                value={formData.stage}
                onChange={(e) => updateFormData('stage', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stage}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Deal Value ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formData.value_cents / 100}
                onChange={(e) => updateFormData('value_cents', Math.round(parseFloat(e.target.value || '0') * 100))}
                placeholder="0.00"
                className={`w-full rounded-lg border px-3 py-2 ${
                  errors.value_cents ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.value_cents && <p className="text-red-500 text-xs mt-1">{errors.value_cents}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Probability (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                value={formData.probability}
                onChange={(e) => updateFormData('probability', parseInt(e.target.value || '0'))}
                className={`w-full rounded-lg border px-3 py-2 ${
                  errors.probability ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.probability && <p className="text-red-500 text-xs mt-1">{errors.probability}</p>}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">Expected Close Date</label>
            <input
              type="date"
              value={formData.expected_close_date}
              onChange={(e) => updateFormData('expected_close_date', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 md:w-auto"
            />
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/deals"
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create Deal'}
          </button>
        </div>

        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-red-600 text-sm">{errors.submit}</p>
          </div>
        )}
      </form>
    </div>
  );
}