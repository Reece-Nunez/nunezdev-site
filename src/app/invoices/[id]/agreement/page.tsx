'use client';

import { useParams } from 'next/navigation';
import { useState, useRef } from 'react';
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
  useState(() => {
    if (invoice?.clients) {
      setName(invoice.clients.name || '');
      setEmail(invoice.clients.email || '');
    }
  });

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 my-36">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-semibold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">Failed to load invoice. Please check the link and try again.</p>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-36">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (invoice.signed_at || signed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-36">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-green-600 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-800 mb-2">Invoice Already Signed</h1>
          <p className="text-gray-600 mb-4">
            This invoice was signed on {new Date(invoice.signed_at || new Date()).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-500">
            If you need to make a payment, please contact NunezDev directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-48">
      <div className="max-w-4xl mx-auto px-4">
        {/* Invoice Header */}
        <div className="bg-white rounded-lg shadow-lg mb-8">
          <div className="border-b-4 p-8" style={{ borderColor: '#ffc312' }}>
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
                <p className="text-gray-600">#{invoice.id.split('-')[0]}</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            {/* Invoice Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
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
                    <th className="text-right py-2 font-semibold text-gray-800">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-100">
                    <td className="py-4 text-gray-600">
                      {invoice.description || 'Web Development Services'}
                    </td>
                    <td className="py-4 text-right text-gray-800 font-medium">
                      {currency(invoice.amount_cents)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Total */}
            <div className="border-t-2 border-gray-200 pt-4 mb-8">
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-800">
                    Total: <span style={{ color: '#ffc312' }}>{currency(invoice.amount_cents)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="mb-8 pb-6 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-2">Terms & Conditions</h3>
              <div className="text-sm text-gray-600 space-y-2">
                <p>• Payment is due within 30 days of invoice date</p>
                <p>• Late payments may be subject to a 1.5% monthly service charge</p>
                <p>• Please include invoice number with payment</p>
                <p>• This invoice requires a digital signature before payment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Signature Section */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">Digital Signature Required</h3>
          <p className="text-gray-600 mb-6">
            By signing below, you acknowledge that you have read and agree to the terms and conditions, 
            and you authorize the payment of this invoice.
          </p>

          {/* Signature Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your full name"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter your email address"
                required
              />
            </div>
          </div>

          {/* Signature Pad */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Digital Signature *</label>
            <div className="border-2 border-gray-300 rounded-lg bg-white">
              <SignaturePad
                ref={pad}
                canvasProps={{
                  className: 'w-full h-40 rounded-lg',
                  style: { width: '100%', height: '160px' }
                }}
              />
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={clearSignature}
                className="text-sm text-gray-500 hover:text-gray-700"
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
              className="px-8 py-3 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>This is a secure, legally binding digital signature process.</p>
          <p>© {new Date().getFullYear()} NunezDev. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
