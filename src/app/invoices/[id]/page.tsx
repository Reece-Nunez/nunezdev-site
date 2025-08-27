'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import Link from 'next/link';
import { currency } from '@/lib/ui';
import EditInvoice from '@/components/client-detail/EditInvoice';
import { InvoiceStatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
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
  hosted_invoice_url?: string;
  invoice_number?: string;
  title?: string;
  notes?: string;
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
      <div className="p-6 my-36">
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
      <div className="p-6 my-36">
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
      <div className="p-6 my-36 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/invoices" className="text-blue-600 hover:underline text-sm">
            ← Back to Invoices
          </Link>
          <h1 className="text-2xl font-semibold mt-2">
            {invoice.invoice_number || `Invoice #${invoice.id.split('-')[0]}`}
          </h1>
          {invoice.title && <p className="text-gray-600 text-sm mt-1">{invoice.title}</p>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowEdit(true)}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: '#5b7c99' }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#4a6780'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#5b7c99'}
          >
            Edit
          </button>
          <button
            onClick={() => setShowPreview(true)}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Preview
          </button>
          {invoice.status === 'draft' && (
            <button
              onClick={handleSendInvoice}
              disabled={sending}
              className="px-4 py-2 text-white rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#ffc312' }}
              onMouseEnter={(e) => !sending && (e.target.style.backgroundColor = '#e6ad0f')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = '#ffc312')}
            >
              {sending ? 'Sending...' : 'Send Invoice'}
            </button>
          )}
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Client Information */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
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
        <div className="rounded-xl border bg-white p-6 shadow-sm">
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
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Line Items</h2>
          <div className="overflow-x-auto">
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
          
          {/* Invoice Totals */}
          <div className="mt-4 border-t pt-4">
            <div className="flex justify-end">
              <div className="w-64 space-y-2">
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
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Notes</h2>
          <div className="text-gray-700 whitespace-pre-wrap">{invoice.notes}</div>
        </div>
      )}

      {/* Signature Status */}
      {(invoice.signed_at || invoice.hosted_invoice_url) && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Signature Status</h2>
          {invoice.signed_at ? (
            <div className="flex items-center gap-2 text-green-600">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">Signed on {new Date(invoice.signed_at).toLocaleDateString()}</span>
              {invoice.signer_name && <span>by {invoice.signer_name}</span>}
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
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Payment History</h2>
          <div className="overflow-x-auto">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg bg-white">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Invoice Preview</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        {/* Invoice Preview Content */}
        <div className="p-8">
          <InvoicePreviewContent invoice={invoice} />
        </div>
      </div>
    </div>
  );
}

function InvoicePreviewContent({ invoice }: { invoice: Invoice }) {
  return (
    <div className="max-w-2xl mx-auto bg-white">
      {/* Header with Logo/Branding */}
      <div className="border-b-4 border-yellow pb-8 mb-8" style={{ borderColor: '#ffc312' }}>
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4">
            <img 
              src="/logo.png" 
              alt="NunezDev Logo" 
              className="w-16 h-16 object-contain"
            />
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#111111' }}>NunezDev</h1>
              <p className="text-gray-600 mt-1">Professional Web Development Services</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold" style={{ color: '#5b7c99' }}>INVOICE</h2>
            <p className="text-gray-600">
              #{invoice.invoice_number || invoice.id.split('-')[0]}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <h3 className="font-semibold mb-2" style={{ color: '#111111' }}>From:</h3>
          <div className="text-gray-600">
            <div className="flex items-center gap-3 mb-2">
              <img 
                src="/reece-avatar.png" 
                alt="Reece Nunez" 
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="font-medium text-gray-800">Reece Nunez</p>
                <p className="text-sm">NunezDev</p>
              </div>
            </div>
            <p>Professional Web Developer</p>
            <p>Email: contact@nunezdev.com</p>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold text-gray-800 mb-2">Bill To:</h3>
          <div className="text-gray-600">
            <p className="font-medium">{invoice.clients?.name}</p>
            {invoice.clients?.company && <p>{invoice.clients.company}</p>}
            <p>{invoice.clients?.email}</p>
            {invoice.clients?.phone && <p>{invoice.clients.phone}</p>}
          </div>
        </div>
      </div>

      {/* Invoice Info */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          {invoice.issued_at && (
            <div className="mb-2">
              <span className="font-medium text-gray-800">Issue Date:</span>
              <span className="text-gray-600 ml-2">{new Date(invoice.issued_at).toLocaleDateString()}</span>
            </div>
          )}
          {invoice.due_at && (
            <div>
              <span className="font-medium text-gray-800">Due Date:</span>
              <span className="text-gray-600 ml-2">{new Date(invoice.due_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Service Details */}
      <div className="mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-200">
              <th className="text-left py-2 font-semibold text-gray-800">Description</th>
              {invoice.line_items && invoice.line_items.length > 0 && (
                <>
                  <th className="text-center py-2 font-semibold text-gray-800">Qty</th>
                  <th className="text-right py-2 font-semibold text-gray-800">Rate</th>
                </>
              )}
              <th className="text-right py-2 font-semibold text-gray-800">Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.line_items && invoice.line_items.length > 0 ? (
              invoice.line_items.map((item, index) => (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-3 text-gray-600">{item.description}</td>
                  <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                  <td className="py-3 text-right text-gray-600">{currency(item.rate_cents)}</td>
                  <td className="py-3 text-right text-gray-800 font-medium">{currency(item.amount_cents)}</td>
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-100">
                <td className="py-4 text-gray-600">
                  {invoice.description || invoice.title || 'Services'}
                </td>
                <td className="py-4 text-right text-gray-800 font-medium">
                  {currency(invoice.amount_cents)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="border-t-2 border-gray-200 pt-4">
        <div className="flex justify-end">
          <div className="w-64 space-y-2 text-right">
            {invoice.subtotal_cents && (
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span className="text-gray-800">{currency(invoice.subtotal_cents)}</span>
              </div>
            )}
            {invoice.tax_cents && invoice.tax_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Tax:</span>
                <span className="text-gray-800">{currency(invoice.tax_cents)}</span>
              </div>
            )}
            {invoice.discount_cents && invoice.discount_cents > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Discount:</span>
                <span className="text-green-600">-{currency(invoice.discount_cents)}</span>
              </div>
            )}
            <div className="border-t pt-2">
              <div className="text-xl font-bold text-gray-800 flex justify-between">
                <span>Total:</span>
                <span style={{ color: '#ffc312' }}>{currency(invoice.amount_cents)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="mt-8 pt-6 border-t border-gray-200">
        <h3 className="font-semibold text-gray-800 mb-2">Terms & Conditions</h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>• {getPaymentTermsDescription(invoice.payment_terms || '30')}</p>
          <p>• Late payments may be subject to a 1.5% monthly service charge</p>
          <p>• Please include invoice number with payment</p>
          <p>• This invoice requires a digital signature before payment</p>
        </div>
      </div>

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
            <div className="flex items-center text-green-800">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">
                Signed by {invoice.signer_name || invoice.clients?.name} on {new Date(invoice.signed_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}