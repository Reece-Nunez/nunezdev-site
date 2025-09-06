'use client';

import { useState } from 'react';

export default function AutomationTestPage() {
  const [invoiceId, setInvoiceId] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const runTest = async (testType: 'payment' | 'signing' | 'combined' | 'debug' | 'cleanup') => {
    if (!invoiceId.trim()) {
      alert('Please enter an invoice ID');
      return;
    }

    setLoading(true);
    try {
      const endpoint = testType === 'combined' 
        ? '/api/test/invoice-automation'
        : testType === 'payment'
        ? '/api/test/payment-automation' 
        : testType === 'debug'
        ? '/api/debug/test-automation'
        : testType === 'cleanup'
        ? '/api/debug/cleanup-test-payments'
        : '/api/test/signing-automation';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoice_id: invoiceId })
      });

      const data = await response.json();
      setResults(data);
    } catch (error) {
      setResults({ error: 'Test failed', details: error });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold">Invoice Automation Testing</h1>
          <button 
            className="border border-gray-300 bg-yellow px-4 py-2 rounded-lg hover:bg-yellow/50 transition whitespace-nowrap"
            onClick={() => window.location.href = '/dashboard'}
          >
            Dashboard
          </button>
        </div>
        
        {/* Input */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <label className="block text-sm font-medium mb-2">
            Invoice ID to Test:
          </label>
          <div className="flex gap-4">
            <input
              type="text"
              value={invoiceId}
              onChange={(e) => setInvoiceId(e.target.value)}
              placeholder="Enter an invoice ID from your database..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
        </div>

        {/* Test Buttons */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-xl font-semibold mb-4">Run Tests:</h2>
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => runTest('combined')}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Running...' : 'Test Both (Payment + Signing)'}
            </button>
            <button
              onClick={() => runTest('payment')}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              Test Payment Only
            </button>
            <button
              onClick={() => runTest('signing')}
              disabled={loading}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              Test Signing Only
            </button>
            <button
              onClick={() => runTest('debug')}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              🐛 Debug Test (Detailed)
            </button>
            <button
              onClick={() => runTest('cleanup')}
              disabled={loading}
              className="px-6 py-3 bg-yellow text-white rounded-lg hover:bg-yellow/70 disabled:opacity-50"
            >
              🧹 Clean Test Data
            </button>
          </div>
        </div>

        {/* Results */}
        {results && (
          <div className="bg-white p-6 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Test Results:</h2>
            
            {results.success ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <h3 className="font-semibold text-green-800">✅ Test Completed Successfully!</h3>
                </div>
                
                {results.results && (
                  <div className="space-y-3">
                    {results.results.payment_automation && (
                      <div className={`p-3 rounded border ${results.results.payment_automation.working 
                        ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <h4 className="font-semibold">Payment Automation: {results.results.payment_automation.working ? '✅ WORKING' : '❌ NOT WORKING'}</h4>
                        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(results.results.payment_automation.details, null, 2)}</pre>
                      </div>
                    )}
                    
                    {results.results.signing_automation && (
                      <div className={`p-3 rounded border ${results.results.signing_automation.working 
                        ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <h4 className="font-semibold">Signing Automation: {results.results.signing_automation.working ? '✅ WORKING' : '❌ NOT WORKING'}</h4>
                        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(results.results.signing_automation.details, null, 2)}</pre>
                      </div>
                    )}

                    {results.results.automation_working !== undefined && (
                      <div className={`p-3 rounded border ${results.results.automation_working 
                        ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <h4 className="font-semibold">Single Test Result: {results.results.automation_working ? '✅ WORKING' : '❌ NOT WORKING'}</h4>
                        <pre className="text-xs mt-2 overflow-auto">{JSON.stringify(results.results, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h3 className="font-semibold text-red-800">❌ Test Failed</h3>
                <p className="text-red-700 mt-2">{results.error}</p>
                {results.details && (
                  <pre className="text-xs mt-2 overflow-auto text-red-600">{JSON.stringify(results.details, null, 2)}</pre>
                )}
              </div>
            )}

            {/* Raw JSON Output */}
            <details className="mt-6">
              <summary className="cursor-pointer font-semibold text-gray-700">View Raw JSON Response</summary>
              <pre className="mt-2 p-3 bg-gray-100 rounded text-xs overflow-auto">
                {JSON.stringify(results, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}