'use client';

import { useState } from 'react';

interface DebugEndpoint {
  path: string;
  description: string;
  method: string;
  category: string;
}

const debugEndpoints: DebugEndpoint[] = [
  // Database & Setup
  { path: '/api/debug/tables', description: 'View database table schemas', method: 'GET', category: 'Database' },
  { path: '/api/debug/seed', description: 'Seed database with test data', method: 'POST', category: 'Database' },
  { path: '/api/debug/supabase', description: 'Test Supabase connection', method: 'GET', category: 'Database' },
  
  // Environment & Auth
  { path: '/api/debug/env', description: 'View environment variables', method: 'GET', category: 'Environment' },
  { path: '/api/debug/env-detailed', description: 'Detailed environment info', method: 'GET', category: 'Environment' },
  { path: '/api/debug/env-full', description: 'Full environment dump', method: 'GET', category: 'Environment' },
  { path: '/api/debug/nextauth', description: 'NextAuth debug info', method: 'GET', category: 'Auth' },
  { path: '/api/debug/auth-test', description: 'Test authentication', method: 'GET', category: 'Auth' },
  
  // Payments & Financial
  { path: '/api/debug/payments', description: 'Debug payment issues', method: 'GET', category: 'Payments' },
  { path: '/api/debug/fix-payments', description: 'Fix payment data', method: 'POST', category: 'Payments' },
  { path: '/api/debug/create-payment', description: 'Manually create payment', method: 'POST', category: 'Payments' },
  { path: '/api/debug/find-payment', description: 'Find and link payments', method: 'GET/POST', category: 'Payments' },
  { path: '/api/debug/cleanup-test-payments', description: 'Clean up test payments', method: 'POST', category: 'Payments' },
  { path: '/api/debug/matt-payments', description: 'Debug Matt\'s payments', method: 'GET', category: 'Payments' },
  
  // Data Fixes & Maintenance
  { path: '/api/debug/fix-date', description: 'Fix date formatting issues', method: 'POST', category: 'Data Fixes' },
  { path: '/api/debug/fix-views', description: 'Fix database views', method: 'POST', category: 'Data Fixes' },
  { path: '/api/debug/update-views', description: 'Update database views', method: 'POST', category: 'Data Fixes' },
  { path: '/api/debug/invoice-payment-plan', description: 'Fix invoice payment plans', method: 'POST', category: 'Data Fixes' },
  
  // Testing & Development
  { path: '/api/debug/test-automation', description: 'Test automation endpoints', method: 'GET', category: 'Testing' },
  { path: '/api/debug/charts', description: 'Debug chart data', method: 'GET', category: 'Testing' },
  { path: '/api/debug/clients-endpoint', description: 'Test clients endpoint', method: 'GET', category: 'Testing' },
  { path: '/api/debug/client-invoices', description: 'Debug client invoices', method: 'GET', category: 'Testing' },
];

const categories = [...new Set(debugEndpoints.map(e => e.category))];

export default function DebugApisPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [response, setResponse] = useState<string>('');
  const [loading, setLoading] = useState<string>('');

  const filteredEndpoints = selectedCategory === 'All' 
    ? debugEndpoints 
    : debugEndpoints.filter(e => e.category === selectedCategory);

  const testEndpoint = async (endpoint: DebugEndpoint) => {
    setLoading(endpoint.path);
    setResponse('');

    try {
      const method = endpoint.method.includes('GET') ? 'GET' : endpoint.method;
      const res = await fetch(endpoint.path, { method });
      const data = await res.text();
      
      setResponse(`${endpoint.path} (${res.status}):\n${data}`);
    } catch (error) {
      setResponse(`Error calling ${endpoint.path}:\n${error}`);
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-36">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Debug API Endpoints</h1>
            <p className="text-gray-600 mt-1">
              Test and debug various API endpoints. Be careful with POST endpoints as they may modify data.
            </p>
          </div>

          <div className="p-6">
            {/* Category Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Endpoints Grid */}
            <div className="grid gap-4 mb-6">
              {filteredEndpoints.map((endpoint) => (
                <div key={endpoint.path} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        endpoint.method.includes('GET') ? 'bg-green-100 text-green-800' :
                        endpoint.method.includes('POST') ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {endpoint.path}
                      </code>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                        {endpoint.category}
                      </span>
                    </div>
                    <button
                      onClick={() => testEndpoint(endpoint)}
                      disabled={loading === endpoint.path}
                      className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                    >
                      {loading === endpoint.path ? 'Testing...' : 'Test'}
                    </button>
                  </div>
                  <p className="text-sm text-gray-600">{endpoint.description}</p>
                </div>
              ))}
            </div>

            {/* Response Display */}
            {response && (
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                <pre>{response}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}