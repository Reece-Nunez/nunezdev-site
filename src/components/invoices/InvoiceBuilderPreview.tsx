'use client';

import { currency } from '@/lib/ui';
import type { CreateInvoiceData } from '@/types/invoice';

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

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface InvoiceBuilderPreviewProps {
  invoiceData: CreateInvoiceData;
  clients: Client[];
  onClose: () => void;
}

export default function InvoiceBuilderPreview({ 
  invoiceData, 
  clients, 
  onClose 
}: InvoiceBuilderPreviewProps) {
  const selectedClient = clients.find(c => c.id === invoiceData.client_id);
  const subtotal = invoiceData.line_items.reduce((sum, item) => sum + item.amount_cents, 0);
  const total = subtotal; // Add tax/discount calculation if needed

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
          <div className="max-w-2xl mx-auto bg-white">
            {/* Header with Logo/Branding */}
            <div className="border-b-4 pb-8 mb-8" style={{ borderColor: invoiceData.brand_primary || '#ffc312' }}>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                  <img 
                    src={invoiceData.brand_logo_url || '/logo.png'} 
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
                  <p className="text-gray-600">#{Date.now().toString().slice(-8)}</p>
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
                <h3 className="font-semibold mb-2" style={{ color: '#111111' }}>Bill To:</h3>
                <div className="text-gray-600">
                  <p className="font-medium">{selectedClient?.name || 'Client Name'}</p>
                  {selectedClient?.company && <p>{selectedClient.company}</p>}
                  <p>{selectedClient?.email || 'client@email.com'}</p>
                </div>
              </div>
            </div>

            {/* Invoice Title & Description */}
            {(invoiceData.title || invoiceData.description) && (
              <div className="mb-8">
                {invoiceData.title && (
                  <h3 className="text-xl font-semibold mb-2" style={{ color: '#111111' }}>
                    {invoiceData.title}
                  </h3>
                )}
                {invoiceData.description && (
                  <p className="text-gray-600">{invoiceData.description}</p>
                )}
              </div>
            )}

            {/* Service Details */}
            <div className="mb-8">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 font-semibold text-gray-800">Description</th>
                    <th className="text-center py-2 font-semibold text-gray-800">Hrs</th>
                    <th className="text-right py-2 font-semibold text-gray-800">Rate</th>
                    <th className="text-right py-2 font-semibold text-gray-800">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceData.line_items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600">{item.description || 'Service Description'}</td>
                      <td className="py-3 text-center text-gray-600">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600">{currency(item.rate_cents)}</td>
                      <td className="py-3 text-right text-gray-800 font-medium">{currency(item.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4 mb-8">
              <div className="flex justify-end">
                <div className="w-64 space-y-2 text-right">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-800">{currency(subtotal)}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="text-xl font-bold text-gray-800 flex justify-between">
                      <span>Total:</span>
                      <span style={{ color: invoiceData.brand_primary || '#ffc312' }}>
                        {currency(total)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="mb-8">
                <h3 className="font-semibold text-gray-800 mb-2">Notes</h3>
                <div className="text-gray-600 whitespace-pre-wrap">{invoiceData.notes}</div>
              </div>
            )}

            {/* Payment Terms */}
            <div className="mb-8">
              <h3 className="font-semibold text-gray-800 mb-2">Payment Terms</h3>
              <div className="text-gray-600">
                <p>{getPaymentTermsDescription(invoiceData.payment_terms)}</p>
                {invoiceData.require_signature && (
                  <p className="text-sm text-amber-600 mt-2">
                    ⚠️ Digital signature required before payment
                  </p>
                )}
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2">Terms & Conditions</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• {getPaymentTermsDescription(invoiceData.payment_terms)}</p>
                <p>• Late payments may be subject to a 1.5% monthly service charge</p>
                <p>• Please include invoice number with payment</p>
                {invoiceData.require_signature && (
                  <p>• This invoice requires a digital signature before payment</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}