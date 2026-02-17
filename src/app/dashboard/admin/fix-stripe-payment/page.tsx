'use client';

import { useState, useEffect } from 'react';

interface PaymentSearchResult {
  payment_intent_id: string;
  target_amount: number;
  target_amount_usd: string;
  stripe_payment_details?: {
    amount_cents: number;
    amount_usd: string;
    currency: string;
    status: string;
    created_date: string;
    description?: string;
    customer?: string;
  };
  search_results: {
    existing_payment_records: any[];
    invoice_with_payment_intent: any[];
    potential_invoice_matches: Array<{
      id: string;
      invoice_number: string;
      amount_cents: number;
      status: string;
      client_id: string;
      total_paid_cents: number;
      remaining_balance_cents: number;
      created_at: string;
      remaining_after_payment: number;
      will_be_fully_paid: boolean;
      payment_fits: boolean;
      clients: {
        name: string;
        email: string;
      };
      match_score?: number;
      match_reasons?: string[];
    }>;
  };
  analysis: {
    payment_already_recorded: boolean;
    invoice_has_payment_intent: boolean;
    potential_matches_count: number;
    stripe_payment_fetched?: boolean;
    stripe_payment_status?: string;
    note?: string;
  };
}

export default function FixStripePaymentPage() {
  const [searchResult, setSearchResult] = useState<PaymentSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [paymentIntentId, setPaymentIntentId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]); // Default to today
  const [paymentAmount, setPaymentAmount] = useState<string>(''); // Allow custom amount for partial payments
  const [invoiceFilter, setInvoiceFilter] = useState<string>(''); // Filter invoices by client name, email, or invoice number

  // Don't auto-search on mount, wait for user to enter payment intent ID

  const searchForPayment = async () => {
    if (!paymentIntentId.trim()) {
      setMessage('❌ Please enter a payment intent ID first');
      return;
    }

    if (!paymentIntentId.startsWith('pi_')) {
      setMessage('❌ Payment intent ID should start with "pi_"');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`/api/debug/find-payment?payment_intent_id=${paymentIntentId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setSearchResult(data);

      // Auto-populate payment amount from Stripe if available
      if (data.stripe_payment_details?.amount_usd) {
        setPaymentAmount(data.stripe_payment_details.amount_usd);
      }

      // Auto-populate payment date from Stripe if available  
      if (data.stripe_payment_details?.created_date) {
        const stripeDate = new Date(data.stripe_payment_details.created_date).toISOString().split('T')[0];
        setPaymentDate(stripeDate);
      }

      // Auto-select first potential match if available
      if (data.search_results.potential_invoice_matches.length > 0) {
        setSelectedInvoiceId(data.search_results.potential_invoice_matches[0].id);
      }

    } catch (error: any) {
      console.error('Error searching payment:', error);
      setMessage(`❌ Search Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPaymentIntentId('');
    setSearchResult(null);
    setSelectedInvoiceId('');
    setMessage('');
  };

  const fixPayment = async () => {
    if (!selectedInvoiceId) {
      setMessage('❌ Please select an invoice first');
      return;
    }

    if (!paymentDate) {
      setMessage('❌ Please select a payment date');
      return;
    }

    const amountCents = paymentAmount ? Math.round(parseFloat(paymentAmount) * 100) : null;
    if (paymentAmount && (isNaN(amountCents!) || amountCents! <= 0)) {
      setMessage('❌ Please enter a valid payment amount');
      return;
    }

    setFixing(true);
    setMessage('');

    try {
      const response = await fetch('/api/debug/find-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: selectedInvoiceId,
          payment_intent_id: paymentIntentId,
          payment_date: paymentDate,
          payment_amount_cents: amountCents, // Allow custom amount for partial payments
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fix failed');
      }

      setMessage(`✅ Payment fixed successfully! Invoice ${data.changes.final_invoice_state.invoice_number} is now marked as ${data.changes.final_invoice_state.status}`);

      // Refresh search results
      await searchForPayment();

    } catch (error: any) {
      console.error('Error fixing payment:', error);
      setMessage(`❌ Fix Error: ${error.message}`);
    } finally {
      setFixing(false);
    }
  };

  const createMissingPaymentRecord = async () => {
    if (!searchResult?.search_results.invoice_with_payment_intent[0]) {
      setMessage('❌ No linked invoice found');
      return;
    }

    const linkedInvoice = searchResult.search_results.invoice_with_payment_intent[0];

    setFixing(true);
    setMessage('');

    try {
      const response = await fetch('/api/debug/find-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_id: linkedInvoice.id,
          payment_intent_id: paymentIntentId,
          payment_date: paymentDate,
          payment_amount_cents: paymentAmount ? Math.round(parseFloat(paymentAmount) * 100) : null,
          force_create_missing: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create payment record');
      }

      setMessage(`✅ Missing payment record created successfully! Invoice ${data.changes.final_invoice_state.invoice_number} is now marked as ${data.changes.final_invoice_state.status}`);

      // Refresh search results
      await searchForPayment();

    } catch (error: any) {
      console.error('Error creating missing payment record:', error);
      console.error('Full error details:', error);
      setMessage(`❌ Error: ${error.message}`);
    } finally {
      setFixing(false);
    }
  };

  if (loading && !searchResult) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Searching for payment...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-36">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Fix Missing Stripe Payment</h1>
            <p className="text-gray-600 mt-1">
              Link a Stripe payment to an invoice in your system. Enter the payment intent ID from Stripe to get started.
            </p>

            {/* Payment Intent Input */}
            <div className="mt-4 space-y-3">
              <div>
                <label htmlFor="payment-intent" className="block text-sm font-medium text-gray-700">
                  Stripe Payment Intent ID
                </label>
                <div className="mt-1 flex gap-3">
                  <input
                    type="text"
                    id="payment-intent"
                    value={paymentIntentId}
                    onChange={(e) => setPaymentIntentId(e.target.value)}
                    placeholder="pi_3S3eb9I6Rruvv9u802NRnttF"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={searchForPayment}
                    disabled={loading || !paymentIntentId.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Searching...' : 'Search'}
                  </button>

                  {searchResult && (
                    <button
                      onClick={resetForm}
                      className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {searchResult?.stripe_payment_details && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <h4 className="font-medium text-green-900 mb-2">✅ Stripe Payment Retrieved</h4>
                  <div className="space-y-1 text-green-800">
                    <div><strong>Amount:</strong> ${searchResult.stripe_payment_details.amount_usd} {searchResult.stripe_payment_details.currency.toUpperCase()}</div>
                    <div><strong>Status:</strong> {searchResult.stripe_payment_details.status}</div>
                    <div><strong>Date:</strong> {new Date(searchResult.stripe_payment_details.created_date).toLocaleDateString()}</div>
                    {searchResult.stripe_payment_details.description && (
                      <div><strong>Description:</strong> {searchResult.stripe_payment_details.description}</div>
                    )}
                  </div>
                </div>
              )}

              {searchResult && searchResult.target_amount_usd === "Unknown" && (
                <div className="text-sm text-gray-600">
                  <strong>Status:</strong> Ready to search for matching invoices
                </div>
              )}

              {/* Payment Details Section */}
              {searchResult && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use the actual date when the payment was made
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Amount (Optional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      placeholder="Leave empty for full invoice amount"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      For partial payments, enter the specific amount
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6">
            {message && (
              <div className={`mb-6 p-4 rounded-lg ${message.startsWith('✅')
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
                }`}>
                {message}
              </div>
            )}

            {searchResult && (
              <div className="space-y-6">
                {/* Analysis Summary */}
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className={`p-2 rounded ${searchResult.analysis.payment_already_recorded ? 'bg-green-100' : 'bg-red-100'}`}>
                      <strong>Payment Recorded:</strong> {searchResult.analysis.payment_already_recorded ? 'Yes ✅' : 'No ❌'}
                    </div>
                    <div className={`p-2 rounded ${searchResult.analysis.invoice_has_payment_intent ? 'bg-green-100' : 'bg-orange-100'}`}>
                      <strong>Invoice Linked:</strong> {searchResult.analysis.invoice_has_payment_intent ? 'Yes ✅' : 'No ⚠️'}
                    </div>
                    <div className="p-2 rounded bg-blue-100">
                      <strong>Potential Matches:</strong> {searchResult.analysis.potential_matches_count}
                    </div>
                  </div>
                </div>

                {/* Existing Payment Records */}
                {searchResult.search_results.existing_payment_records.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">✅ Existing Payment Records</h3>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-green-800">This payment is already recorded in the system!</p>
                      {searchResult.search_results.existing_payment_records.map((payment: any, index: number) => (
                        <div key={index} className="mt-2 p-2 bg-white rounded border">
                          <p><strong>Invoice:</strong> {payment.invoices.invoice_number}</p>
                          <p><strong>Amount:</strong> ${(payment.amount_cents / 100).toFixed(2)}</p>
                          <p><strong>Client:</strong> {payment.invoices.clients.name}</p>
                          <p><strong>Paid At:</strong> {new Date(payment.paid_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invoice with Payment Intent */}
                {searchResult.search_results.invoice_with_payment_intent.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">🔗 Invoice Already Linked</h3>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-blue-800 mb-3">This invoice is already linked to the Stripe payment, but no payment record exists!</p>
                      {searchResult.search_results.invoice_with_payment_intent.map((invoice: any, index: number) => (
                        <div key={index} className="p-2 bg-white rounded border mb-4">
                          <p><strong>Invoice:</strong> {invoice.invoice_number}</p>
                          <p><strong>Status:</strong> {invoice.status}</p>
                          <p><strong>Amount:</strong> ${(invoice.amount_cents / 100).toFixed(2)}</p>
                          <p><strong>Client:</strong> {invoice.clients.name}</p>
                        </div>
                      ))}

                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                        <h4 className="font-semibold text-yellow-900 mb-2">🚧 Missing Payment Record</h4>
                        <p className="text-yellow-800 mb-4">
                          The invoice is linked to this Stripe payment, but the payment record is missing from the database.
                          This can happen when Stripe webhooks fail or are processed incorrectly.
                        </p>
                        <button
                          onClick={() => createMissingPaymentRecord()}
                          disabled={fixing}
                          className="bg-yellow hover:bg-yellow/50 text-black px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                        >
                          {fixing ? 'Creating Payment Record...' : 'Create Missing Payment Record'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Potential Matches */}
                {searchResult.search_results.potential_invoice_matches.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">🎯 Potential Invoice Matches</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Showing invoices and their remaining balance after applying ${searchResult.target_amount_usd} payment
                    </p>

                    {/* Invoice Search/Filter */}
                    <div className="mb-4">
                      <label htmlFor="invoice-filter" className="block text-sm font-medium text-gray-700 mb-1">
                        Filter Invoices
                      </label>
                      <input
                        type="text"
                        id="invoice-filter"
                        value={invoiceFilter}
                        onChange={(e) => setInvoiceFilter(e.target.value)}
                        placeholder="Search by client name, email, or invoice number..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-3">
                      {searchResult.search_results.potential_invoice_matches
                        .filter(invoice => {
                          if (!invoiceFilter) return true;
                          const search = invoiceFilter.toLowerCase();
                          return (
                            invoice.invoice_number?.toLowerCase().includes(search) ||
                            invoice.clients?.name?.toLowerCase().includes(search) ||
                            invoice.clients?.email?.toLowerCase().includes(search)
                          );
                        })
                        .map((invoice: any) => (
                        <div key={invoice.id}
                          className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedInvoiceId === invoice.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                            }`}
                          onClick={() => setSelectedInvoiceId(invoice.id)}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="radio"
                                  checked={selectedInvoiceId === invoice.id}
                                  onChange={() => setSelectedInvoiceId(invoice.id)}
                                  className="text-blue-600"
                                />
                                <strong className="text-lg">{invoice.invoice_number}</strong>
                                <span className={`px-2 py-1 text-xs rounded-full ${invoice.status === 'paid'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                  {invoice.status}
                                </span>
                                {invoice.match_score > 0 && (
                                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                    Match: {invoice.match_score}
                                  </span>
                                )}
                              </div>
                              <p><strong>Client:</strong> {invoice.clients?.name} ({invoice.clients?.email})</p>
                              <p><strong>Invoice Amount:</strong> ${(invoice.amount_cents / 100).toFixed(2)}</p>
                              <p><strong>Currently Paid:</strong> ${((invoice.total_paid_cents || 0) / 100).toFixed(2)}</p>
                              <p><strong>Current Balance Due:</strong> ${((invoice.remaining_balance_cents || 0) / 100).toFixed(2)}</p>
                              
                              {/* Enhanced payment preview */}
                              <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-blue-400">
                                <p className="text-sm font-medium text-gray-800 mb-1">After applying ${searchResult.target_amount_usd} payment:</p>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-600">Remaining Balance:</span>
                                    <span className={`ml-2 font-semibold ${
                                      invoice.remaining_after_payment > 0 
                                        ? 'text-orange-600' 
                                        : 'text-green-600'
                                    }`}>
                                      ${(invoice.remaining_after_payment / 100).toFixed(2)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className={`text-sm px-2 py-1 rounded-full ${
                                      invoice.will_be_fully_paid 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-orange-100 text-orange-800'
                                    }`}>
                                      {invoice.will_be_fully_paid ? '✅ Will be PAID' : '⚠️ Still partially due'}
                                    </span>
                                  </div>
                                </div>
                                {!invoice.payment_fits && (
                                  <p className="text-red-600 text-sm mt-2">⚠️ Payment amount exceeds invoice balance</p>
                                )}
                              </div>
                              
                              {invoice.match_reasons && invoice.match_reasons.length > 0 && (
                                <div className="mt-2 p-2 bg-blue-50 rounded text-sm">
                                  <p className="font-medium text-blue-900 mb-1">Match Reasons:</p>
                                  <ul className="text-blue-800 text-xs">
                                    {invoice.match_reasons.map((reason: string, idx: number) => (
                                      <li key={idx}>• {reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              {invoice.stripe_payment_intent_id && (
                                <p className="text-sm text-orange-600 mt-2">
                                  <strong>⚠️ Already linked to:</strong> {invoice.stripe_payment_intent_id}
                                </p>
                              )}
                              
                              <p className="text-sm text-gray-500 mt-2"><strong>Created:</strong> {new Date(invoice.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedInvoiceId && !searchResult.analysis.payment_already_recorded && (
                      <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                        <h4 className="font-semibold text-yellow-900 mb-2">Ready to Apply Payment</h4>
                        <p className="text-yellow-800 mb-4">
                          This will link the ${searchResult.target_amount_usd} Stripe payment to the selected invoice{searchResult.search_results.potential_invoice_matches.find((inv: any) => inv.id === selectedInvoiceId)?.will_be_fully_paid ? ' and mark it as PAID' : ' as a partial payment'}.
                        </p>
                        {(() => {
                          const selectedInvoice = searchResult.search_results.potential_invoice_matches.find((inv: any) => inv.id === selectedInvoiceId);
                          return selectedInvoice && selectedInvoice.remaining_after_payment > 0 ? (
                            <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-4">
                              <p className="text-orange-800 text-sm">
                                <strong>Note:</strong> Invoice will still have ${(selectedInvoice.remaining_after_payment / 100).toFixed(2)} remaining due after this payment.
                              </p>
                            </div>
                          ) : null;
                        })()}
                        <button
                          onClick={fixPayment}
                          disabled={fixing}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
                        >
                          {fixing ? 'Fixing Payment...' : 'Fix Payment Now'}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* No matches found */}
                {searchResult.search_results.potential_invoice_matches.length === 0 &&
                  !searchResult.analysis.payment_already_recorded && (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">No matching invoices found for ${searchResult.target_amount_usd}</p>
                      <p className="text-sm text-gray-400">
                        The payment may need manual review or the invoice might not exist in the system.
                      </p>
                    </div>
                  )}
              </div>
            )}

            <div className="mt-6 flex space-x-4">
              <button
                onClick={searchForPayment}
                disabled={loading}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Searching...' : 'Refresh Search'}
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className='bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md font-medium transition-colors'
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}