'use client';

import { useState, useEffect } from 'react';

interface PaymentInstallment {
  id: string;
  installment_number: number;
  installment_label: string;
  amount_cents: number;
  due_date: string | null;
  grace_period_days: number;
  status: 'pending' | 'paid' | 'failed' | 'cancelled' | 'overdue';
  stripe_payment_link_url: string | null;
  paid_at: string | null;
}

interface PaymentPlanDisplayProps {
  invoiceId: string;
  isPublic?: boolean; // Whether this is being viewed by the client (public) or owner (private)
  onPaymentClick?: (installment: PaymentInstallment) => void;
  className?: string;
}

export default function PaymentPlanDisplay({ 
  invoiceId, 
  isPublic = false, 
  onPaymentClick,
  className = "" 
}: PaymentPlanDisplayProps) {
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPaymentPlan();
  }, [invoiceId]);

  const fetchPaymentPlan = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invoices/${invoiceId}/payment-plans`);
      if (!response.ok) {
        throw new Error('Failed to fetch payment plan');
      }
      
      const data = await response.json();
      if (data.payment_plan_enabled && data.installments) {
        setInstallments(data.installments);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading payment plan');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'cancelled': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return '✓';
      case 'pending': return '○';
      case 'overdue': return '!';
      case 'failed': return '×';
      case 'cancelled': return '−';
      default: return '○';
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'No due date';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const isOverdue = (installment: PaymentInstallment) => {
    if (!installment.due_date || installment.status === 'paid') return false;
    const dueDate = new Date(installment.due_date);
    const gracePeriodEnd = new Date(dueDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + installment.grace_period_days);
    return new Date() > gracePeriodEnd;
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-6 bg-gray-200 rounded mb-4"></div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || installments.length === 0) {
    return null; // Don't show anything if no payment plan or error
  }

  // If only one installment and it's a full payment, don't show as a payment plan
  if (installments.length === 1 && installments[0].installment_label === 'Full Payment') {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-4">Payment Plan</h3>
      
      <div className="space-y-3">
        {installments.map((installment, index) => (
          <div 
            key={installment.id}
            className={`border rounded-lg p-4 transition-all ${
              isOverdue(installment) && installment.status === 'pending' 
                ? 'border-red-300 bg-red-50' 
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${getStatusColor(installment.status)}`}>
                  {getStatusIcon(installment.status)}
                </div>
                
                <div>
                  <h4 className="font-medium text-gray-900">
                    {installment.installment_label}
                  </h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span>${(installment.amount_cents / 100).toFixed(2)}</span>
                    <span>Due: {formatDate(installment.due_date)}</span>
                    {installment.grace_period_days > 0 && (
                      <span className="text-xs text-gray-500">
                        ({installment.grace_period_days} day grace period)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {installment.status === 'paid' && installment.paid_at && (
                  <div className="text-sm text-green-600">
                    Paid {new Date(installment.paid_at).toLocaleDateString()}
                  </div>
                )}
                
                {installment.status === 'pending' && installment.stripe_payment_link_url && (
                  <div className="flex space-x-2">
                    <a
                      href={installment.stripe_payment_link_url}
                      onClick={() => onPaymentClick?.(installment)}
                      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                        isOverdue(installment)
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {isOverdue(installment) ? 'Pay Now (Overdue)' : 'Pay Now'}
                    </a>
                  </div>
                )}

                {installment.status === 'pending' && !installment.stripe_payment_link_url && !isPublic && (
                  <button 
                    className="text-sm text-blue-600 hover:text-blue-800"
                    onClick={() => generatePaymentLinks()}
                  >
                    Generate Payment Link
                  </button>
                )}
              </div>
            </div>

            {isOverdue(installment) && installment.status === 'pending' && (
              <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                <strong>Overdue:</strong> This payment was due on {formatDate(installment.due_date)}
                {installment.grace_period_days > 0 && 
                  ` (grace period ended ${installment.grace_period_days} days later)`
                }
              </div>
            )}
          </div>
        ))}
      </div>

      {!isPublic && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
          <div className="flex justify-between">
            <span>Total Paid:</span>
            <span className="font-medium text-green-600">
              ${(installments.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount_cents, 0) / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Remaining:</span>
            <span className="font-medium text-orange-600">
              ${(installments.filter(i => i.status !== 'paid').reduce((sum, i) => sum + i.amount_cents, 0) / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );

  async function generatePaymentLinks() {
    try {
      const response = await fetch(`/api/invoices/${invoiceId}/payment-plans`, {
        method: 'POST'
      });
      if (response.ok) {
        fetchPaymentPlan(); // Refresh the data
      }
    } catch (err) {
      console.error('Error generating payment links:', err);
    }
  }
}