'use client';

import { useParams } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import useSWR from 'swr';
import SignaturePad from 'react-signature-canvas';
import { currency } from '@/lib/ui';

interface Invoice {
  id: string;
  amount_cents: number;
  description?: string;
  issued_at?: string;
  due_at?: string;
  signed_at?: string;
  signer_name?: string;
  clients?: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
  };
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function InvoiceAgreementPage() {
  const params = useParams();
  const invoiceId = params.id as string;
  
  const pad = useRef<SignaturePad>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  const { data: invoice, error } = useSWR<Invoice>(
    invoiceId ? `/api/invoices/${invoiceId}/details` : null,
    fetcher
  );

  // Pre-fill client information if available
  useEffect(() => {
    if (invoice?.clients) {
      setName(invoice.clients.name || '');
      setEmail(invoice.clients.email || '');
    }
  }, [invoice?.clients]);

  // Resize signature pad when window resizes
  useEffect(() => {
    const resizeSignaturePad = () => {
      if (pad.current) {
        const canvas = pad.current.getCanvas();
        const container = canvas.parentElement;
        if (container) {
          const containerWidth = container.offsetWidth;
          const ratio = Math.max(window.devicePixelRatio || 1, 1);
          
          // Set actual canvas size in memory (scaled up for high DPI displays)
          canvas.width = containerWidth * ratio;
          canvas.height = 120 * ratio;
          
          // Scale canvas back down using CSS
          canvas.style.width = containerWidth + 'px';
          canvas.style.height = '120px';
          
          // Scale the drawing context so everything draws at the correct size
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.scale(ratio, ratio);
          }
          
          // Clear and redraw if needed
          pad.current.clear();
        }
      }
    };

    // Initial resize
    const timeoutId = setTimeout(resizeSignaturePad, 100);
    
    // Add resize listener
    window.addEventListener('resize', resizeSignaturePad);
    
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', resizeSignaturePad);
    };
  }, []);

  const handleSign = async () => {
    const empty = pad.current?.isEmpty();
    if (!name || !email || empty) {
      alert('Please fill in your name, email, and provide a signature.');
      return;
    }

    setSigning(true);
    try {
      const signatureDataUrl = pad.current!.toDataURL('image/svg+xml');
      
      const res = await fetch(`/api/invoices/${invoiceId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name, 
          email, 
          signature: signatureDataUrl,
          ip_address: 'client' // You could get actual IP if needed
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error saving signature');
      }

      setSigned(true);
      // Could redirect to a payment page or success page
      alert('Invoice signed successfully! You may now proceed with payment.');
      
    } catch (error) {
      console.error('Error signing invoice:', error);
      alert(error instanceof Error ? error.message : 'Failed to sign invoice');
    } finally {
      setSigning(false);
    }
  };

  const clearSignature = () => {
    pad.current?.clear();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3 sm:p-4 py-12 sm:py-36">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 max-w-md w-full text-center min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold text-red-600 mb-3 sm:mb-4">Error</h1>
          <p className="text-sm sm:text-base text-gray-600">Failed to load invoice. Please check the link and try again.</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3 sm:p-4 py-12 sm:py-36">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 max-w-md w-full min-w-0">
          <div className="animate-pulse space-y-3 sm:space-y-4">
            <div className="h-5 sm:h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-1.5 sm:space-y-2">
              <div className="h-3 sm:h-4 bg-gray-200 rounded"></div>
              <div className="h-3 sm:h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (invoice.signed_at || signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-3 sm:p-4 py-12 sm:py-36">
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 max-w-md w-full text-center min-w-0">
          <div className="text-green-600 mb-3 sm:mb-4">
            <svg className="w-12 h-12 sm:w-16 sm:h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">Invoice Already Signed</h1>
          <p className="text-sm sm:text-base text-gray-600 mb-3 sm:mb-4">
            This invoice was signed on {new Date(invoice.signed_at || new Date()).toLocaleDateString()}
          </p>
          <p className="text-xs sm:text-sm text-gray-500">
            If you need to make a payment, please contact NunezDev directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-12 lg:py-48">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 min-w-0">
        {/* Invoice Header */}
        <div className="bg-white rounded-lg shadow-lg mb-4 sm:mb-8 min-w-0">
          <div className="border-b-4 p-4 sm:p-6 lg:p-8" style={{ borderColor: '#ffc312' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                <img 
                  src="/logo.png" 
                  alt="NunezDev Logo" 
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate" style={{ color: '#111111' }}>NunezDev</h1>
                  <p className="text-sm sm:text-base text-gray-600 mt-1">Professional Web Development Services</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <h2 className="text-xl sm:text-2xl font-bold" style={{ color: '#5b7c99' }}>INVOICE</h2>
                <p className="text-sm text-gray-600">#{invoice.id.split('-')[0]}</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 lg:p-8">
            {/* Invoice Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
              <div>
                <h3 className="font-semibold mb-2 text-sm sm:text-base" style={{ color: '#111111' }}>From:</h3>
                <div className="text-gray-600">
                  <div className="flex items-center gap-3 mb-2">
                    <img 
                      src="/reece-avatar.png" 
                      alt="Reece Nunez" 
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 text-sm sm:text-base">Reece Nunez</p>
                      <p className="text-xs sm:text-sm">NunezDev</p>
                    </div>
                  </div>
                  <p className="text-sm sm:text-base">Professional Web Developer</p>
                  <p className="text-sm sm:text-base">Email: contact@nunezdev.com</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Bill To:</h3>
                <div className="text-gray-600">
                  <p className="font-medium text-sm sm:text-base">{invoice.clients?.name}</p>
                  {invoice.clients?.company && <p className="text-sm sm:text-base">{invoice.clients.company}</p>}
                  <p className="text-sm sm:text-base">{invoice.clients?.email}</p>
                  {invoice.clients?.phone && <p className="text-sm sm:text-base">{invoice.clients.phone}</p>}
                </div>
              </div>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 mb-6 sm:mb-8">
              <div>
                {invoice.issued_at && (
                  <div className="mb-2">
                    <span className="font-medium text-gray-800 text-sm sm:text-base">Issue Date:</span>
                    <span className="text-gray-600 ml-2 text-sm sm:text-base">{new Date(invoice.issued_at).toLocaleDateString()}</span>
                  </div>
                )}
                {invoice.due_at && (
                  <div>
                    <span className="font-medium text-gray-800 text-sm sm:text-base">Due Date:</span>
                    <span className="text-gray-600 ml-2 text-sm sm:text-base">{new Date(invoice.due_at).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Service Details */}
            <div className="mb-6 sm:mb-8">
              {/* Desktop Table - hidden on small screens */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 font-semibold text-gray-800 text-sm lg:text-base">Description</th>
                      <th className="text-right py-2 font-semibold text-gray-800 text-sm lg:text-base">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-4 text-gray-600 text-sm lg:text-base">
                        {invoice.description || 'Web Development Services'}
                      </td>
                      <td className="py-4 text-right text-gray-800 font-medium text-sm lg:text-base">
                        {currency(invoice.amount_cents)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              
              {/* Mobile Card - visible on small screens */}
              <div className="sm:hidden border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Service Description</div>
                    <div className="text-sm text-gray-800">
                      {invoice.description || 'Web Development Services'}
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Total Amount</span>
                      <span className="text-lg font-semibold text-gray-800">
                        {currency(invoice.amount_cents)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4 mb-6 sm:mb-8">
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800">
                    Total: <span style={{ color: '#ffc312' }}>{currency(invoice.amount_cents)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2 text-sm sm:text-base">Terms & Conditions</h3>
              <div className="text-xs sm:text-sm text-gray-600 space-y-1.5 sm:space-y-2">
                <p>• Payment is due within 30 days of invoice date</p>
                <p>• Late payments may be subject to a 1.5% monthly service charge</p>
                <p>• Please include invoice number with payment</p>
                <p>• This invoice requires a digital signature before payment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 lg:p-8 min-w-0">
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-3 sm:mb-4">Digital Signature Required</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            By signing below, you acknowledge that you have read and agree to the terms and conditions, 
            and you authorize the payment of this invoice.
          </p>

          {/* Signature Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email address"
                required
              />
            </div>
          </div>

          {/* Signature Pad */}
          <div className="mb-4 sm:mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1 sm:mb-2">Digital Signature *</label>
            <div className="border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
              <SignaturePad
                ref={pad}
                canvasProps={{
                  className: 'w-full h-[120px] rounded-lg block',
                  width: 800,
                  height: 120,
                  style: { 
                    width: '100%', 
                    height: '120px',
                    maxWidth: '100%',
                    display: 'block',
                    touchAction: 'none'
                  }
                }}
                penColor="black"
                backgroundColor="rgba(255,255,255,1)"
                dotSize={1}
                minWidth={0.5}
                maxWidth={2.5}
                throttle={16}
                minDistance={5}
                velocityFilterWeight={0.7}
              />
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs sm:text-sm text-gray-500 hover:text-gray-700"
              >
                Clear Signature
              </button>
            </div>
          </div>

          {/* Sign Button */}
          <div className="flex justify-center">
            <button
              onClick={handleSign}
              disabled={signing}
              className="px-4 sm:px-6 lg:px-8 py-2.5 sm:py-3 text-sm sm:text-base text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                backgroundColor: '#ffc312',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => (e.target as HTMLElement).style.backgroundColor = '#e6ad0f'}
              onMouseLeave={(e) => (e.target as HTMLElement).style.backgroundColor = '#ffc312'}
            >
              {signing ? 'Signing Invoice...' : 'Sign Invoice & Acknowledge Terms'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6 sm:mt-8 text-xs sm:text-sm text-gray-500">
          <p>This is a secure, legally binding digital signature process.</p>
          <p>© {new Date().getFullYear()} NunezDev. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
