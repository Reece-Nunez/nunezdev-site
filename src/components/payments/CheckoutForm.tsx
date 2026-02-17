'use client';

import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { currency } from '@/lib/ui';

interface CheckoutFormProps {
  amount: number;
  invoiceNumber: string;
  returnUrl: string;
}

export default function CheckoutForm({ amount, invoiceNumber, returnUrl }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: returnUrl,
      },
    });

    if (error) {
      setErrorMessage(error.message || 'An unexpected error occurred.');
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-sm text-gray-600">Invoice</p>
            <p className="font-semibold text-gray-900">#{invoiceNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600">Amount Due</p>
            <p className="text-2xl font-bold text-gray-900">{currency(amount)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{errorMessage}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || isProcessing}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
      >
        {isProcessing ? 'Processing...' : `Pay ${currency(amount)}`}
      </button>

      <p className="text-xs text-center text-gray-500">
        Powered by Stripe. Your payment information is secure and encrypted.
      </p>
    </form>
  );
}
