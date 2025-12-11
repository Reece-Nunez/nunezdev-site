'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { currency } from '@/lib/ui';
import EditInvoice from '@/components/client-detail/EditInvoice';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import PaymentPlanDisplay from '@/components/invoices/PaymentPlanDisplay';
import type { InvoiceLite } from '@/types/client_detail';

function getPaymentTermsDisplay(terms: string): string {
  switch (terms) {
    case 'due_on_receipt': return 'Due on receipt';
    case '7': return 'Net 7 days';
    case '14': return 'Net 14 days';
    case '30': return 'Net 30 days';
    case '45': return 'Net 45 days';
    case '60': return 'Net 60 days';
    case '90': return 'Net 90 days';
    default: return `Net ${terms} days`;
  }
}

function getPaymentTermsDescription(terms: string): string {
  switch (terms) {
    case 'due_on_receipt': return 'Payment is due immediately upon receipt of this invoice.';
    case '7': return 'Payment is due within 7 days from the invoice date.';
    case '14': return 'Payment is due within 14 days from the invoice date.';
    case '30': return 'Payment is due within 30 days from the invoice date.';
    case '45': return 'Payment is due within 45 days from the invoice date.';
    case '60': return 'Payment is due within 60 days from the invoice date.';
    case '90': return 'Payment is due within 90 days from the invoice date.';
    default: return `Payment is due within ${terms} days from the invoice date.`;
  }
}

interface Invoice extends InvoiceLite {
  client_id: string;
  signed_at?: string;
  signer_name?: string;
  signer_email?: string;
  signature_svg?: string;
  hosted_invoice_url?: string;
  invoice_number?: string;
  title?: string;
  notes?: string;
  require_signature?: boolean;
  line_items?: Array<{
    description: string;
    quantity: number;
    rate_cents: number;
    amount_cents: number;
  }>;
  subtotal_cents?: number;
  tax_cents?: number;
  discount_cents?: number;
  payment_terms?: string;
  // Enhanced fields
  project_overview?: string;
  project_start_date?: string;
  delivery_date?: string;
  discount_type?: 'percentage' | 'fixed';
  discount_value?: number;
  technology_stack?: string[];
  terms_conditions?: string;
  clients?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
  invoice_payments?: Array<{
    id: string;
    amount_cents: number;
    payment_method: string;
    paid_at: string;
  }>;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const invoiceId = params.id as string;
  
  const [showPreview, setShowPreview] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [sending, setSending] = useState(false);
  const { showToast, ToastContainer } = useToast();

  const { data: invoice, error, mutate } = useSWR<Invoice>(
    invoiceId ? `/api/invoices/${invoiceId}/details` : null,
    fetcher
  );

  const handleSendInvoice = async () => {
    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send invoice');
      }

      // Refresh invoice data
      mutate();
      
      // Get the response data to check if email was sent
      const result = await response.json();
      showToast(result.message || 'Invoice sent successfully!', 'success');
    } catch (error) {
      console.error('Error sending invoice:', error);
      showToast(error instanceof Error ? error.message : 'Failed to send invoice', 'error');
    } finally {
      setSending(false);
    }
  };


  if (error) {
    return (
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-7xl mx-auto min-w-0">
        <h1 className="text-2xl font-semibold mb-4 text-red-600">Error</h1>
        <p>Failed to load invoice: {error.message}</p>
        <Link href="/dashboard/invoices" className="text-blue-600 hover:underline mt-4 inline-block">
          ← Back to Invoices
        </Link>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-7xl mx-auto min-w-0">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="h-4 bg-gray-200 rounded w-32"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer />
      <div className="px-3 py-4 sm:p-6 space-y-4 max-w-7xl mx-auto min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/dashboard/invoices" className="text-blue-600 hover:underline text-sm">
            ← Back to Invoices
          </Link>
          <h1 className="text-2xl font-semibold mt-2">
            {invoice.invoice_number || `Invoice #${invoice.id.split('-')[0]}`}
          </h1>
          {invoice.title && <p className="text-gray-600 text-sm mt-1">{invoice.title}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/invoices/${invoice.id}/edit`}
            className="px-3 py-2 sm:px-4 text-sm sm:text-base text-white rounded-lg transition-colors bg-blue-600 hover:bg-blue-700"
          >
            Edit Invoice
          </Link>
          <button
            onClick={() => setShowPreview(true)}
            className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Preview
          </button>
          {invoice.status === 'draft' && (
            <button
              onClick={handleSendInvoice}
              disabled={sending}
              className="px-3 py-2 sm:px-4 text-sm sm:text-base text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#ffc312' }}
              onMouseEnter={(e) => !sending && ((e.target as HTMLElement).style.backgroundColor = '#e6ad0f')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = '#ffc312')}
            >
              {sending ? 'Sending...' : 'Send Invoice'}
            </button>
          )}
          {['sent', 'overdue', 'partially_paid'].includes(invoice.status) && (
            <button
              onClick={handleSendInvoice}
              disabled={sending}
              className="px-3 py-2 sm:px-4 text-sm sm:text-base text-white rounded-lg disabled:opacity-50 transition-colors bg-emerald-600 hover:bg-emerald-700"
            >
              {sending ? 'Sending...' : 'Resend Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Client Information */}
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Client Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Name</label>
              <div className="text-lg">{invoice.clients?.name || 'N/A'}</div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Email</label>
              <div>{invoice.clients?.email || 'N/A'}</div>
            </div>
            {invoice.clients?.phone && (
              <div>
                <label className="text-sm font-medium text-gray-600">Phone</label>
                <div>{invoice.clients.phone}</div>
              </div>
            )}
            {invoice.clients?.company && (
              <div>
                <label className="text-sm font-medium text-gray-600">Company</label>
                <div>{invoice.clients.company}</div>
              </div>
            )}
          </div>
        </div>

        {/* Invoice Information */}
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Invoice Information</h2>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600">Status</label>
              <div className="mt-1">
                <InvoiceStatusBadge status={invoice.status} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-600">Amount</label>
              <div className="text-2xl font-bold text-green-600">{currency(invoice.amount_cents)}</div>
            </div>
            {invoice.issued_at && (
              <div>
                <label className="text-sm font-medium text-gray-600">Issued</label>
                <div>{new Date(invoice.issued_at).toLocaleDateString()}</div>
              </div>
            )}
            {invoice.due_at && (
              <div>
                <label className="text-sm font-medium text-gray-600">Due</label>
                <div>{new Date(invoice.due_at).toLocaleDateString()}</div>
              </div>
            )}
            {invoice.description && (
              <div>
                <label className="text-sm font-medium text-gray-600">Description</label>
                <div className="text-sm text-gray-700">{invoice.description}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items */}
      {invoice.line_items && invoice.line_items.length > 0 && (
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Line Items</h2>
          
          {/* Desktop Table - hidden on small screens */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-center w-20">Qty</th>
                  <th className="px-3 py-2 text-right w-28">Rate</th>
                  <th className="px-3 py-2 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.line_items.map((item, index) => (
                  <tr key={index} className="border-t">
                    <td className="px-3 py-2">{item.description}</td>
                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{currency(item.rate_cents)}</td>
                    <td className="px-3 py-2 text-right font-medium">{currency(item.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible on small screens */}
          <div className="md:hidden space-y-4">
            {invoice.line_items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  <div className="font-medium text-gray-800">{item.description}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Quantity</div>
                      <div className="text-sm font-medium">{item.quantity}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Rate</div>
                      <div className="text-sm font-medium">{currency(item.rate_cents)}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</span>
                      <span className="text-lg font-semibold text-gray-800">{currency(item.amount_cents)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Invoice Totals */}
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2">
                {invoice.subtotal_cents && (
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{currency(invoice.subtotal_cents)}</span>
                  </div>
                )}
                {invoice.tax_cents && invoice.tax_cents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Tax:</span>
                    <span>{currency(invoice.tax_cents)}</span>
                  </div>
                )}
                {invoice.discount_cents && invoice.discount_cents > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Discount:</span>
                    <span className="text-green-600">-{currency(invoice.discount_cents)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{currency(invoice.amount_cents)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <div className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</div>
        </div>
      )}

      {/* Signature Status */}
      {(invoice.signed_at || invoice.hosted_invoice_url) && (
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Signature Status</h2>
          {invoice.signed_at ? (
            <div>
              <div className="flex items-center gap-2 text-green-600 mb-3">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Signed on {new Date(invoice.signed_at).toLocaleDateString()}</span>
                {invoice.signer_name && <span>by {invoice.signer_name}</span>}
              </div>
              {invoice.signature_svg && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 inline-block">
                  <img
                    src={invoice.signature_svg}
                    alt="Client signature"
                    className="max-h-20 w-auto"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-amber-600">
                <span className="font-medium">Signature Required</span> - Invoice is awaiting client signature
              </div>
              {invoice.hosted_invoice_url && (
                <Link 
                  href={`/invoices/${invoice.id}/agreement`}
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  View Signature Page
                </Link>
              )}
            </div>
          )}
        </div>
      )}

      {/* Payments */}
      {invoice.invoice_payments && invoice.invoice_payments.length > 0 && (
        <div className="rounded-xl border bg-white p-4 sm:p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Payment History</h2>
          
          {/* Desktop Table - hidden on small screens */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Date</th>
                  <th className="text-left py-2">Method</th>
                  <th className="text-right py-2">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.invoice_payments.map((payment) => (
                  <tr key={payment.id} className="border-b">
                    <td className="py-2">{new Date(payment.paid_at).toLocaleDateString()}</td>
                    <td className="py-2 capitalize">{payment.payment_method}</td>
                    <td className="py-2 text-right font-medium">{currency(payment.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards - visible on small screens */}
          <div className="sm:hidden space-y-3">
            {invoice.invoice_payments.map((payment) => (
              <div key={payment.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Date</span>
                    <span className="text-sm font-medium">{new Date(payment.paid_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Method</span>
                    <span className="text-sm font-medium capitalize">{payment.payment_method}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Amount</span>
                      <span className="text-lg font-semibold text-gray-800">{currency(payment.amount_cents)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showPreview && (
        <InvoicePreviewModal
          invoice={invoice}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Invoice Edit Modal */}
      {showEdit && (
        <EditInvoice
          invoice={invoice}
          onUpdated={() => {
            mutate(); // Refresh the invoice data
            setShowEdit(false);
          }}
          onCancel={() => setShowEdit(false)}
        />
      )}
    </div>
    </>
  );
}

function InvoicePreviewModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 sm:p-4">
      <div className="w-full max-w-4xl max-h-[95vh] overflow-auto rounded-lg bg-white min-w-0">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b p-3 sm:p-4 flex justify-between items-center">
          <h2 className="text-base sm:text-lg font-semibold">Invoice Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ✕
          </button>
        </div>

        {/* Invoice Preview Content */}
        <div className="p-3 sm:p-8">
          <InvoicePreviewContent invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

function InvoicePreviewContent({ invoice }: { invoice: Invoice }) {
  // Calculate discount for display
  const subtotal = invoice.subtotal_cents || invoice.line_items?.reduce((sum, item) => sum + item.amount_cents, 0) || 0;
  let discount = 0;
  if (invoice.discount_value && invoice.discount_value > 0) {
    if (invoice.discount_type === 'percentage') {
      discount = Math.round(subtotal * (invoice.discount_value / 100));
    } else {
      discount = Math.round(invoice.discount_value * 100); // Convert to cents
    }
  }
  
  return (
    <div className="max-w-3xl mx-auto bg-white">
      {/* Enhanced Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-4xl font-bold truncate" style={{ color: '#111111' }}>INVOICE</h1>
        <h2 className="text-sm sm:text-xl text-gray-600 mt-2 px-2">{invoice.title || 'Professional Development Services'}</h2>
      </div>

      {/* Client Information */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Client Information</h3>
        <div className="text-gray-700">
          <p className="font-medium text-lg">{invoice.clients?.name}</p>
          {invoice.clients?.company && <p className="text-gray-600">{invoice.clients.company}</p>}
          {invoice.clients?.email && <p className="text-gray-600">{invoice.clients.email}</p>}
          {invoice.clients?.phone && <p className="text-gray-600">{invoice.clients.phone}</p>}
        </div>
      </div>

      {/* Enhanced Invoice Details */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Invoice Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Invoice #:</span>
            <span className="text-gray-800">{invoice.invoice_number || invoice.id.split('-')[0]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Date:</span>
            <span className="text-gray-800">{invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString() : new Date().toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Due Date:</span>
            <span className="text-gray-800">{invoice.due_at ? new Date(invoice.due_at).toLocaleDateString() : 'TBD'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Payment Terms:</span>
            <span className="text-gray-800">{getPaymentTermsDisplay(invoice.payment_terms || '30')}</span>
          </div>
          {invoice.project_start_date && (
            <div className="flex justify-between">
              <span className="text-gray-600">Project Start:</span>
              <span className="text-gray-800">{new Date(invoice.project_start_date).toLocaleDateString()}</span>
            </div>
          )}
          {invoice.delivery_date && (
            <div className="flex justify-between">
              <span className="text-gray-600">Delivery Date:</span>
              <span className="text-gray-800">{new Date(invoice.delivery_date).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Project Overview */}
      {invoice.project_overview && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Project Overview</h3>
          <p className="text-gray-700 leading-relaxed">{invoice.project_overview}</p>
        </div>
      )}

      {/* Service Details */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4" style={{ color: '#111111' }}>Service Details</h3>
        
        {/* Desktop Table - hidden on small screens */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="text-left py-3 font-semibold text-gray-800">Service Description</th>
                <th className="text-center py-3 font-semibold text-gray-800">Hours</th>
                <th className="text-right py-3 font-semibold text-gray-800">Rate</th>
                <th className="text-right py-3 font-semibold text-gray-800">Amount</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items && invoice.line_items.length > 0 ? (
                invoice.line_items.map((item, index) => (
                  <tr key={index} className="border-b border-gray-200">
                    <td className="py-4 text-gray-700 pr-4">{item.description}</td>
                    <td className="py-4 text-center text-gray-700">{item.quantity}</td>
                    <td className="py-4 text-right text-gray-700">{currency(item.rate_cents)}</td>
                    <td className="py-4 text-right text-gray-800 font-semibold">{currency(item.amount_cents)}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-gray-200">
                  <td className="py-4 text-gray-700">
                    {invoice.description || invoice.title || 'Professional Services'}
                  </td>
                  <td className="py-4 text-right text-gray-800 font-semibold" colSpan={3}>
                    {currency(invoice.amount_cents)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - visible on small screens */}
        <div className="md:hidden space-y-4">
          {invoice.line_items && invoice.line_items.length > 0 ? (
            invoice.line_items.map((item, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  <div className="font-medium text-gray-800">{item.description}</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Hours</div>
                      <div className="text-sm font-medium">{item.quantity}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">Rate</div>
                      <div className="text-sm font-medium">{currency(item.rate_cents)}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</span>
                      <span className="text-lg font-semibold text-gray-800">{currency(item.amount_cents)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="space-y-3">
                <div className="font-medium text-gray-800">
                  {invoice.description || invoice.title || 'Professional Services'}
                </div>
                <div className="pt-2 border-t border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</span>
                    <span className="text-lg font-semibold text-gray-800">{currency(invoice.amount_cents)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Totals */}
      <div className="border-t-2 border-gray-300 pt-4 mb-8">
        <div className="flex justify-end">
          <div className="w-full max-w-md space-y-3">
            <div className="flex justify-between text-gray-700">
              <span>Subtotal ({invoice.line_items?.reduce((sum, item) => sum + item.quantity, 0) || 1} hours × {currency(invoice.line_items?.[0]?.rate_cents || invoice.amount_cents)}):</span>
              <span className="font-semibold">{currency(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>
                  Project Discount ({invoice.discount_type === 'percentage' 
                    ? `${invoice.discount_value}%` 
                    : 'Fixed Amount'}):
                </span>
                <span className="font-semibold">-{currency(discount)}</span>
              </div>
            )}
            <div className="border-t pt-3">
              <div className="text-xl font-bold text-gray-800 flex justify-between">
                <span>Total Project Cost:</span>
                <span>{currency(invoice.amount_cents)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Plan */}
      <PaymentPlanDisplay 
        invoiceId={invoice.id} 
        isPublic={false}
        className="mb-8"
      />

      {/* Technology Stack */}
      {invoice.technology_stack && invoice.technology_stack.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Technology Stack</h3>
          <p className="text-gray-700 mb-3">Your project will be built using modern, industry-standard technologies:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {invoice.technology_stack.map((tech, index) => (
              <div key={index} className="flex items-center">
                <span className="w-2 h-2 bg-blue-500 rounded-full mr-3 flex-shrink-0"></span>
                <span className="text-gray-700">{tech}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Enhanced Terms & Conditions */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Terms & Conditions</h3>
        <div className="space-y-2 text-gray-700 text-sm">
          <p><strong>Payment Terms:</strong> {getPaymentTermsDescription(invoice.payment_terms || '30')}</p>
          {invoice.project_start_date && invoice.delivery_date && (
            <p><strong>Project Timeline:</strong> {Math.ceil((new Date(invoice.delivery_date).getTime() - new Date(invoice.project_start_date).getTime()) / (1000 * 60 * 60 * 24))} days from project start to delivery.</p>
          )}
          <p><strong>Revisions:</strong> Up to 3 rounds of revisions included. Additional revisions billed at $75/hour.</p>
          <p><strong>Content:</strong> Client responsible for providing all text content, images, and branding materials.</p>
          <p><strong>Support:</strong> 30 days of free post-launch support included for bug fixes and minor adjustments.</p>
          {invoice.require_signature && (
            <p><strong>Signature:</strong> Digital signature required before payment processing.</p>
          )}
          {invoice.terms_conditions && (
            <div className="mt-4 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
              <p className="text-gray-800 whitespace-pre-wrap">{invoice.terms_conditions}</p>
            </div>
          )}
        </div>
      </div>

      {/* Thank You Section */}
      <div className="text-center py-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold mb-2" style={{ color: '#ffc312' }}>
          Thank you for choosing our development services!
        </h3>
        <p className="text-gray-600">
          We look forward to bringing your project to life. Please don't hesitate to reach out with any questions.
        </p>
        <div className="mt-4 text-sm text-gray-500">
          <p>Please remit payment via bank transfer, check, or digital payment platform.</p>
        </div>
      </div>

      {/* Additional Notes */}
      {invoice.notes && (
        <div className="mt-6 p-4 bg-gray-50 rounded">
          <h4 className="font-semibold text-gray-800 mb-2">Additional Notes</h4>
          <div className="text-gray-700 text-sm whitespace-pre-wrap">{invoice.notes}</div>
        </div>
      )}

      {/* Signature Section */}
      {!invoice.signed_at && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-4">Signature Required</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              This invoice requires your digital signature to acknowledge the terms and authorize payment.
              You will be able to sign this invoice once it is sent to you.
            </p>
          </div>
        </div>
      )}

      {invoice.signed_at && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="font-semibold text-gray-800 mb-2">Digital Signature</h3>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center text-green-800 mb-3">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">
                Signed by {invoice.signer_name || invoice.clients?.name} on {new Date(invoice.signed_at).toLocaleDateString()}
              </span>
            </div>
            {invoice.signature_svg && (
              <div className="bg-white border border-gray-200 rounded p-2 inline-block">
                <img
                  src={invoice.signature_svg}
                  alt="Client signature"
                  className="max-h-24 w-auto"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}