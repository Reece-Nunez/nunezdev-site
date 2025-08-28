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

interface PaymentPlan {
  enabled: boolean;
  type: 'full' | '50_50' | '40_30_30' | 'custom';
  installments: {
    installment_number: number;
    installment_label: string;
    amount_cents: number;
    due_date: string;
    grace_period_days: number;
  }[];
}

interface InvoiceBuilderPreviewProps {
  invoiceData: CreateInvoiceData;
  clients: Client[];
  paymentPlan?: PaymentPlan;
  onClose: () => void;
}

export default function InvoiceBuilderPreview({ 
  invoiceData, 
  clients, 
  paymentPlan,
  onClose 
}: InvoiceBuilderPreviewProps) {
  const selectedClient = clients.find(c => c.id === invoiceData.client_id);
  const subtotal = invoiceData.line_items.reduce((sum, item) => sum + item.amount_cents, 0);
  
  // Calculate discount
  let discount = 0;
  if (invoiceData.discount_value && invoiceData.discount_value > 0) {
    if (invoiceData.discount_type === 'percentage') {
      discount = Math.round(subtotal * (invoiceData.discount_value / 100));
    } else {
      discount = Math.round((invoiceData.discount_value || 0) * 100); // Convert to cents
    }
  }
  
  const total = subtotal - discount;

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
          <div className="max-w-3xl mx-auto bg-white">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold" style={{ color: '#111111' }}>INVOICE</h1>
              <h2 className="text-xl text-gray-600 mt-2">{invoiceData.title || 'Custom Website Development Services'}</h2>
            </div>

            {/* Client Information */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Client Information</h3>
              <div className="text-gray-700">
                <p className="font-medium text-lg">{selectedClient?.name || 'Client Name'}</p>
                {selectedClient?.company && <p className="text-gray-600">{selectedClient.company}</p>}
                {selectedClient?.email && <p className="text-gray-600">{selectedClient.email}</p>}
              </div>
            </div>

            {/* Invoice Details */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Invoice Details</h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Invoice #:</span>
                  <span className="text-gray-800">ND-{new Date().getFullYear()}-{Date.now().toString().slice(-3)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="text-gray-800">{new Date().toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Due Date:</span>
                  <span className="text-gray-800">{
                    (() => {
                      const dueDate = new Date();
                      const days = invoiceData.payment_terms === 'due_on_receipt' ? 0 : parseInt(invoiceData.payment_terms);
                      dueDate.setDate(dueDate.getDate() + days);
                      return dueDate.toLocaleDateString();
                    })()
                  }</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Terms:</span>
                  <span className="text-gray-800">{getPaymentTermsDisplay(invoiceData.payment_terms)}</span>
                </div>
                {invoiceData.project_start_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Project Start:</span>
                    <span className="text-gray-800">{new Date(invoiceData.project_start_date).toLocaleDateString()}</span>
                  </div>
                )}
                {invoiceData.delivery_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery Date:</span>
                    <span className="text-gray-800">{new Date(invoiceData.delivery_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Project Overview */}
            {invoiceData.project_overview && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Project Overview</h3>
                <p className="text-gray-700 leading-relaxed">{invoiceData.project_overview}</p>
              </div>
            )}

            {/* Service Details */}
            <div className="mb-8">
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
                  {invoiceData.line_items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-4 text-gray-700 pr-4">{item.description || 'Service Description'}</td>
                      <td className="py-4 text-center text-gray-700">{item.quantity}</td>
                      <td className="py-4 text-right text-gray-700">{currency(item.rate_cents)}</td>
                      <td className="py-4 text-right text-gray-800 font-semibold">{currency(item.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t-2 border-gray-300 pt-4 mb-8">
              <div className="flex justify-end">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between text-gray-700">
                    <span>Subtotal ({invoiceData.line_items.reduce((sum, item) => sum + item.quantity, 0)} hours × {currency(invoiceData.line_items.length > 0 ? invoiceData.line_items[0].rate_cents : 0)}):</span>
                    <span className="font-semibold">{currency(subtotal)}</span>
                  </div>
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>
                        Project Discount ({invoiceData.discount_type === 'percentage' 
                          ? `${invoiceData.discount_value}%` 
                          : 'Fixed Amount'}):
                      </span>
                      <span className="font-semibold">-{currency(discount)}</span>
                    </div>
                  )}
                  <div className="border-t pt-3">
                    <div className="text-xl font-bold text-gray-800 flex justify-between">
                      <span>Total Project Cost:</span>
                      <span>{currency(total)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Plan */}
            {paymentPlan?.enabled && paymentPlan.installments.length > 1 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4" style={{ color: '#111111' }}>Payment Schedule</h3>
                <p className="text-gray-700 mb-4">
                  This invoice offers a flexible payment plan to make your investment more manageable:
                </p>
                
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="grid gap-3">
                    {paymentPlan.installments.map((installment, index) => {
                      const dueDate = installment.due_date ? new Date(installment.due_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) : 'TBD';
                      
                      return (
                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded border">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                              {index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{installment.installment_label}</div>
                              <div className="text-sm text-gray-600">
                                Due: {dueDate}
                                {installment.grace_period_days > 0 && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    ({installment.grace_period_days} day grace period)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-semibold text-gray-900">
                              {currency(installment.amount_cents)}
                            </div>
                            <div className="text-xs text-gray-500">
                              {((installment.amount_cents / total) * 100).toFixed(0)}% of total
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Payment Plan Total:</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {currency(paymentPlan.installments.reduce((sum, inst) => sum + inst.amount_cents, 0))}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <p><strong>Payment Instructions:</strong> You will receive individual payment links for each installment. Each payment can be made independently when due.</p>
                </div>
              </div>
            )}

            {/* Technology Stack */}
            {invoiceData.technology_stack && invoiceData.technology_stack.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Technology Stack</h3>
                <p className="text-gray-700 mb-3">Your website will be built using modern, industry-standard technologies:</p>
                <div className="grid grid-cols-2 gap-2">
                  {invoiceData.technology_stack.map((tech, index) => (
                    <div key={index} className="flex items-center">
                      <span className="w-2 h-2 bg-blue-500 rounded-full mr-3"></span>
                      <span className="text-gray-700">{tech}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Terms & Conditions */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-3" style={{ color: '#111111' }}>Terms & Conditions</h3>
              <div className="space-y-2 text-gray-700 text-sm">
                <p><strong>Payment Terms:</strong> {getPaymentTermsDescription(invoiceData.payment_terms)}</p>
                {invoiceData.project_start_date && invoiceData.delivery_date && (
                  <p><strong>Project Timeline:</strong> {Math.ceil((new Date(invoiceData.delivery_date).getTime() - new Date(invoiceData.project_start_date).getTime()) / (1000 * 60 * 60 * 24))} days from project start to delivery.</p>
                )}
                <p><strong>Revisions:</strong> Up to 3 rounds of revisions included. Additional revisions billed at $75/hour.</p>
                <p><strong>Content:</strong> Client responsible for providing all text content, images, and branding materials.</p>
                <p><strong>Support:</strong> 30 days of free post-launch support included for bug fixes and minor adjustments.</p>
                {invoiceData.require_signature && (
                  <p><strong>Signature:</strong> Digital signature required before payment processing.</p>
                )}
                {invoiceData.terms_conditions && (
                  <div className="mt-4 p-3 bg-gray-50 rounded border-l-4 border-blue-500">
                    <p className="text-gray-800 whitespace-pre-wrap">{invoiceData.terms_conditions}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Thank You Section */}
            <div className="text-center py-6 border-t border-gray-200">
              <h3 className="text-lg font-semibold mb-2" style={{ color: invoiceData.brand_primary || '#ffc312' }}>
                Thank you for choosing our development services!
              </h3>
              <p className="text-gray-600">
                We look forward to bringing your project to life. Please don't hesitate to reach out with any questions.
              </p>
              <div className="mt-4 text-sm text-gray-500">
                <p>Please remit payment via bank transfer, check, or digital payment platform.</p>
              </div>
            </div>

            {/* Notes */}
            {invoiceData.notes && (
              <div className="mt-6 p-4 bg-gray-50 rounded">
                <h4 className="font-semibold text-gray-800 mb-2">Additional Notes</h4>
                <div className="text-gray-700 text-sm whitespace-pre-wrap">{invoiceData.notes}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}