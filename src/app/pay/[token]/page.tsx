'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import CheckoutForm from '@/components/payments/CheckoutForm';

// Load Stripe publishable key from environment
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface InvoiceData {
  id: string;
  invoice_number: string;
  amount_cents: number;
  title?: string;
  clients?: {
    name: string;
    email: string;
    company?: string;
  };
}

export default function PaymentPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const token = params.token as string;
  const installmentId = searchParams.get('installment');

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(0);
  const lastFetchedKey = useRef<string>('');

  useEffect(() => {
    const key = `${token}-${installmentId}`;
    if (lastFetchedKey.current === key) return;
    lastFetchedKey.current = key;
    fetchInvoiceAndCreateIntent();
  }, [token, installmentId]);

  const fetchInvoiceAndCreateIntent = async () => {
    try {
      // First, fetch invoice details using the token
      const invoiceResponse = await fetch(`/api/public/invoice/${token}`);
      if (!invoiceResponse.ok) {
        throw new Error('Invoice not found');
      }

      const invoiceData = await invoiceResponse.json();
      setInvoice(invoiceData);

      // Create payment intent
      const body: any = {};
      if (installmentId) {
        body.installment_id = installmentId;
      }

      const paymentIntentResponse = await fetch(
        `/api/invoices/${invoiceData.id}/create-payment-intent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!paymentIntentResponse.ok) {
        throw new Error('Failed to create payment intent');
      }

      const { clientSecret: secret, amount: paymentAmount } = await paymentIntentResponse.json();
      setClientSecret(secret);
      setAmount(paymentAmount);
    } catch (err) {
      console.error('Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load payment page');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading payment page...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600">{error || 'Failed to load payment page'}</p>
        </div>
      </div>
    );
  }

  const returnUrl = `${window.location.origin}/invoice/${token}?payment=success`;

  return (
    <div className="min-h-screen bg-gray-50 py-28">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="NunezDev"
            className="w-26 h-16 mx-auto mb-4 object-contain"
          />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Secure Payment</h1>
          <p className="text-gray-600">Complete your payment for {invoice.clients?.name}</p>
        </div>

        {/* Payment Form */}
        <div className="bg-white rounded-lg shadow-lg p-6 md:p-8">
          {clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#2563eb',
                    colorBackground: '#ffffff',
                    colorText: '#1f2937',
                    colorDanger: '#dc2626',
                    fontFamily: 'system-ui, sans-serif',
                    borderRadius: '8px',
                  },
                },
              }}
            >
              <CheckoutForm
                amount={amount}
                invoiceNumber={invoice.invoice_number || invoice.id.split('-')[0]}
                returnUrl={returnUrl}
              />
            </Elements>
          )}
        </div>

        {/* Security Badge */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center text-sm text-gray-600">
            <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            <span>Secure SSL encrypted payment</span>
          </div>
        </div>
      </div>
    </div>
  );
}
