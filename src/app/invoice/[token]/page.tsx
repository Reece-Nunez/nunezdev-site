'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { currency } from '@/lib/ui';
import SignatureCapture from '@/components/invoices/SignatureCapture';
import PaymentPlanDisplay from '@/components/invoices/PaymentPlanDisplay';

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

interface InvoiceData {
  id: string;
  client_id: string;
  invoice_number: string;
  title?: string;
  description?: string;
  notes?: string;
  amount_cents: number;
  subtotal_cents?: number;
  status: string;
  issued_at?: string;
  due_at?: string;
  signed_at?: string;
  signer_name?: string;
  require_signature?: boolean;
  payment_terms?: string;
  stripe_hosted_invoice_url?: string;
  hosted_invoice_url?: string;
  project_overview?: string;
  project_start_date?: string;
  delivery_date?: string;
  terms_conditions?: string;
  line_items?: Array<{
    description: string;
    quantity: number;
    rate_cents: number;
    amount_cents: number;
  }>;
  clients?: {
    name: string;
    email: string;
    company?: string;
    phone?: string;
  };
  brand_logo_url?: string;
  brand_primary?: string;
}

export default function PublicInvoiceView() {
  const params = useParams();
  const token = params.token as string;
  
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  
  // Check for payment success in URL
  const [searchParams] = useState(() => new URLSearchParams(window.location.search));
  const paymentSuccess = searchParams.get('payment') === 'success';

  useEffect(() => {
    fetchInvoice();
  }, [token]);

  const fetchInvoice = async () => {
    try {
      console.log('[PublicInvoice] Fetching invoice for token:', token);
      const response = await fetch(`/api/public/invoice/${token}`);
      console.log('[PublicInvoice] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[PublicInvoice] API error:', response.status, errorText);
        throw new Error(`Invoice not found or access denied (${response.status})`);
      }
      
      const data = await response.json();
      console.log('[PublicInvoice] Received data:', {
        id: data.id,
        invoice_number: data.invoice_number,
        status: data.status,
        require_signature: data.require_signature,
        signed_at: data.signed_at,
        hosted_invoice_url: data.hosted_invoice_url,
        stripe_hosted_invoice_url: data.stripe_hosted_invoice_url,
        clients: data.clients,
        hasId: !!data.id,
        idType: typeof data.id,
        fullData: data
      });
      
      setInvoice(data);
    } catch (err) {
      console.error('[PublicInvoice] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async (signatureData: string, signerName: string, signerEmail: string) => {
    try {
      const response = await fetch(`/api/public/invoice/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatureData, signerName, signerEmail }),
      });

      if (!response.ok) {
        throw new Error('Failed to save signature');
      }

      // Refresh invoice data
      await fetchInvoice();
      setShowSignature(false);
    } catch (err) {
      alert('Failed to save signature. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 sm:py-48">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow mx-auto"></div>
          <p className="mt-4 text-sm sm:text-base text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 sm:py-48 px-3 sm:px-4">
        <div className="text-center max-w-md w-full">
          <h1 className="text-xl sm:text-2xl font-bold text-red-600 mb-3 sm:mb-4">Access Denied</h1>
          <p className="text-sm sm:text-base text-gray-600">{error || 'Invalid or expired invoice link'}</p>
        </div>
      </div>
    );
  }

  const needsSignature = invoice.require_signature && !invoice.signed_at;

  // Debug logging
  console.log('[PublicInvoice] Payment URLs debug:', {
    require_signature: invoice.require_signature,
    signed_at: invoice.signed_at,
    needsSignature: needsSignature,
    status: invoice.status,
    hosted_invoice_url: (invoice as any).hosted_invoice_url,
    stripe_hosted_invoice_url: invoice.stripe_hosted_invoice_url,
    willUseStripeUrl: !!invoice.stripe_hosted_invoice_url,
    finalPaymentUrl: invoice.stripe_hosted_invoice_url || (invoice as any).hosted_invoice_url,
  });

  return (
    <div className="min-h-screen bg-gray-50 py-0 sm:py-4 lg:py-8">
      <div className="w-full sm:max-w-5xl mx-auto px-0 sm:px-3 lg:px-4">
        {/* Payment Success Message */}
        {paymentSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <svg className="w-6 h-6 text-green-600 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-green-800 font-medium">Payment Successful!</h3>
                <p className="text-green-700 text-sm mt-1">Thank you for your payment. Your invoice has been paid in full.</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Invoice Container */}
        <div className="bg-white rounded-none sm:rounded-lg shadow-none sm:shadow-lg p-1 sm:p-4 lg:p-6 w-full max-w-none overflow-hidden relative">
          {/* PAID Stamp Overlay */}
          {(invoice.status === 'paid' || paymentSuccess) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div 
                className="transform rotate-12 text-6xl sm:text-8xl lg:text-9xl font-black tracking-wider opacity-20"
                style={{ 
                  color: '#dc2626', 
                  textShadow: '2px 2px 4px rgba(0,0,0,0.1)',
                  fontFamily: 'Arial Black, sans-serif'
                }}
              >
                PAID
              </div>
            </div>
          )}
          {/* Header with Logo/Branding */}
          <div className="border-b-4 pb-2 sm:pb-4 lg:pb-6 mb-4 sm:mb-6" style={{ borderColor: invoice.brand_primary || '#ffc312' }}>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start sm:gap-4">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <img 
                  src={invoice.brand_logo_url || '/logo.png'} 
                  alt="Logo" 
                  className="w-10 h-10 sm:w-14 sm:h-14 object-contain flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h1 className="text-lg sm:text-xl lg:text-2xl font-bold truncate" style={{ color: '#111111' }}>NunezDev</h1>
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5">Professional Web Development Services</p>
                </div>
              </div>
              <div className="text-left sm:text-right flex-shrink-0 self-start">
                <h2 className="text-lg sm:text-xl font-bold" style={{ color: '#5b7c99' }}>INVOICE</h2>
                <p className="text-xs sm:text-sm text-gray-600">#{(() => {
                  console.log('[PublicInvoice] Rendering invoice number:', {
                    invoice_number: invoice.invoice_number,
                    id: invoice.id,
                    hasId: !!invoice.id,
                    idType: typeof invoice.id
                  });
                  return invoice.invoice_number || (invoice.id ? invoice.id.toString().split('-')[0] : 'N/A');
                })()}</p>
                {(invoice.status === 'paid' || paymentSuccess) && (
                  <span className="inline-block mt-1 px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                    PAID
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-xs sm:text-sm" style={{ color: '#111111' }}>From:</h3>
              <div className="text-gray-600">
                <div className="flex items-center gap-2 mb-1">
                  <img 
                    src="/reece-avatar.png" 
                    alt="Reece Nunez" 
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 text-xs sm:text-sm">Reece Nunez</p>
                    <p className="text-xs">NunezDev</p>
                  </div>
                </div>
                <p className="text-xs sm:text-sm">Professional Web Developer</p>
                <p className="text-xs sm:text-sm break-all">contact@nunezdev.com</p>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold mb-1 sm:mb-2 text-xs sm:text-sm" style={{ color: '#111111' }}>Bill To:</h3>
              <div className="text-gray-600">
                <p className="font-medium text-xs sm:text-sm">{invoice.clients?.name}</p>
                {invoice.clients?.company && <p className="text-xs sm:text-sm">{invoice.clients.company}</p>}
                <p className="text-xs sm:text-sm break-all">{invoice.clients?.email}</p>
                {invoice.clients?.phone && <p className="text-xs sm:text-sm">{invoice.clients.phone}</p>}
              </div>
            </div>
          </div>

          {/* Dates */}
          {(invoice.issued_at || invoice.due_at) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
              <div>
                {invoice.issued_at && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-800 text-sm sm:text-base">Issue Date:</span>
                    <span className="text-gray-600 ml-2 text-sm sm:text-base">{new Date(invoice.issued_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              <div>
                {invoice.due_at && (
                  <div>
                    <span className="font-medium text-gray-800 text-sm sm:text-base">Due Date:</span>
                    <span className="text-gray-600 ml-2 text-sm sm:text-base">{new Date(invoice.due_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Invoice Title & Description */}
          {(invoice.title || invoice.description) && (
            <div className="mb-8">
              {invoice.title && (
                <h3 className="text-xl font-semibold mb-2" style={{ color: '#111111' }}>
                  {invoice.title}
                </h3>
              )}
              {invoice.description && (
                <p className="text-gray-600">{invoice.description}</p>
              )}
            </div>
          )}

          {/* Project Overview */}
          {(invoice as any).project_overview && (
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-2" style={{ color: '#111111' }}>
                Project Overview
              </h3>
              <div className="text-gray-600 whitespace-pre-wrap">{(invoice as any).project_overview}</div>
            </div>
          )}

          {/* Project Dates */}
          {((invoice as any).project_start_date || (invoice as any).delivery_date) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
              <div>
                {(invoice as any).project_start_date && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-800 text-sm sm:text-base">Project Start:</span>
                    <span className="text-gray-600 ml-2 text-sm sm:text-base">{new Date((invoice as any).project_start_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              <div>
                {(invoice as any).delivery_date && (
                  <div>
                    <span className="font-medium text-gray-800 text-sm sm:text-base">Delivery Date:</span>
                    <span className="text-gray-600 ml-2 text-sm sm:text-base">{new Date((invoice as any).delivery_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Line Items */}
          <div className="mb-6 sm:mb-8">
            {/* Desktop Table - hidden on small screens */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left py-2 font-semibold text-gray-800 text-sm lg:text-base">Description</th>
                    <th className="text-center py-2 font-semibold text-gray-800 text-sm lg:text-base">Hrs</th>
                    <th className="text-right py-2 font-semibold text-gray-800 text-sm lg:text-base">Rate</th>
                    <th className="text-right py-2 font-semibold text-gray-800 text-sm lg:text-base">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.line_items?.map((item, index) => (
                    <tr key={index} className="border-b border-gray-100">
                      <td className="py-3 text-gray-600 text-sm lg:text-base">{item.description}</td>
                      <td className="py-3 text-center text-gray-600 text-sm lg:text-base">{item.quantity}</td>
                      <td className="py-3 text-right text-gray-600 text-sm lg:text-base">{currency(item.rate_cents)}</td>
                      <td className="py-3 text-right text-gray-800 font-medium text-sm lg:text-base">{currency(item.amount_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Mobile Cards - visible on small screens */}
            <div className="sm:hidden space-y-2">
              {invoice.line_items?.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                  <div className="space-y-2">
                    <div className="font-medium text-gray-800 text-xs leading-tight">{item.description}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Hours</div>
                        <div className="text-sm font-medium">{item.quantity}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 uppercase tracking-wide">Rate</div>
                        <div className="text-sm font-medium">{currency(item.rate_cents)}</div>
                      </div>
                    </div>
                    <div className="pt-1 border-t border-gray-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500 uppercase tracking-wide">Total</span>
                        <span className="text-sm font-semibold text-gray-800">{currency(item.amount_cents)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )) || []}
            </div>
          </div>

          {/* Total */}
          <div className="border-t-2 border-gray-200 pt-4 mb-6 sm:mb-8">
            <div className="flex justify-end">
              <div className="w-full max-w-sm space-y-2 text-right">
                {invoice.subtotal_cents && (
                  <div className="flex justify-between text-sm sm:text-base">
                    <span className="text-gray-600">Subtotal:</span>
                    <span className="text-gray-800">{currency(invoice.subtotal_cents)}</span>
                  </div>
                )}
                <div className="border-t pt-2">
                  <div className="text-lg sm:text-xl font-bold text-gray-800 flex justify-between">
                    <span>Total:</span>
                    <span style={{ color: invoice.brand_primary || '#ffc312' }}>
                      {currency(invoice.amount_cents)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="mb-6 sm:mb-8">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Notes</h3>
              <div className="text-gray-600 whitespace-pre-wrap text-sm sm:text-base">{invoice.notes}</div>
            </div>
          )}

          {/* Payment Terms */}
          <div className="mb-6 sm:mb-8">
            <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Payment Terms</h3>
            <div className="text-gray-600">
              <p className="text-sm sm:text-base">{getPaymentTermsDescription(invoice.payment_terms || '30')}</p>
            </div>
          </div>

          {/* Terms and Conditions */}
          {(invoice as any).terms_conditions && (
            <div className="mb-6 sm:mb-8">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Terms and Conditions</h3>
              <div className="text-gray-600 whitespace-pre-wrap text-sm sm:text-base">{(invoice as any).terms_conditions}</div>
            </div>
          )}

          {/* Payment Plan */}
          <PaymentPlanDisplay
            invoiceId={invoice.id}
            isPublic={true}
            accessToken={token}
            token={token}
            className="mb-8"
            requireSignature={invoice.require_signature || false}
            isSigned={!!invoice.signed_at}
            onPaymentClick={(installment) => {
              // Track payment link click
              console.log('[PublicInvoice] Tracking payment link click:', {
                invoice_id: invoice.id,
                client_id: invoice.client_id,
                activity_type: 'payment_link_clicked',
                installment
              });
              
              fetch('/api/activity/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  invoice_id: invoice.id,
                  client_id: invoice.client_id,
                  activity_type: 'payment_link_clicked',
                  activity_data: {
                    installment_id: installment.id,
                    amount_cents: installment.amount_cents
                  }
                })
              }).then(response => {
                console.log('[PublicInvoice] Activity tracking response:', response.status);
                if (!response.ok) {
                  console.error('[PublicInvoice] Activity tracking failed:', response.status);
                }
              }).catch(error => {
                console.error('[PublicInvoice] Activity tracking error:', error);
              });
            }}
          />

          {/* Signature Section */}
          {invoice.signed_at ? (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2">Digital Signature</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center text-green-800">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="font-medium">
                    Signed by {invoice.signer_name} on {new Date(invoice.signed_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ) : needsSignature ? (
            <div className="mt-8 pt-6 border-t border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-4">Signature Required</h3>
              {!showSignature ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-4">
                    This invoice requires your digital signature to acknowledge the terms and authorize payment.
                  </p>
                  <button
                    onClick={() => setShowSignature(true)}
                    className="px-4 sm:px-6 py-2 text-sm sm:text-base text-white font-medium rounded-lg transition-colors"
                    style={{ backgroundColor: '#ffc312' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e6ad0f'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffc312'}
                  >
                    Sign Invoice
                  </button>
                </div>
              ) : (
                <SignatureCapture
                  onSign={handleSign}
                  onCancel={() => setShowSignature(false)}
                  defaultName={invoice.clients?.name || ''}
                  defaultEmail={invoice.clients?.email || ''}
                />
              )}
            </div>
          ) : null}

          {/* Payment Button - Show if not paid and (no signature required OR already signed) */}
          {!paymentSuccess && invoice.status !== 'paid' && (!invoice.require_signature || invoice.signed_at) && (
            <div className="mt-8 text-center">
              <a
                href={`/pay/${token}`}
                className="inline-block px-6 sm:px-8 py-2.5 sm:py-3 text-sm sm:text-base text-white font-medium rounded-lg transition-colors"
                style={{ backgroundColor: '#5b7c99' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#4a6780'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#5b7c99'}
              >
                Pay Invoice
              </a>
            </div>
          )}

          {/* Payment Completed Message */}
          {(invoice.status === 'paid' || paymentSuccess) && (
            <div className="mt-8 text-center">
              <div className="inline-flex items-center px-4 py-3 bg-green-100 border border-green-300 rounded-lg text-green-800">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Payment Completed - Thank you!</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
          <p>This is a secure invoice link. Do not share with unauthorized parties.</p>
        </div>
      </div>
    </div>
  );
}