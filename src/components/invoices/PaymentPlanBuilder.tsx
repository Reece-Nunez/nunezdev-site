'use client';

import { useState, useEffect } from 'react';

export interface PaymentPlanInstallment {
  id?: string;
  installment_number: number;
  installment_label: string;
  amount_cents: number;
  due_date: string;
  grace_period_days: number;
}

interface PaymentPlanBuilderProps {
  totalAmountCents: number;
  paymentPlan: {
    enabled: boolean;
    type: 'full' | '50_50' | '40_30_30' | 'custom';
    installments: PaymentPlanInstallment[];
  };
  onChange: (paymentPlan: any) => void;
  invoiceDueDate?: string;
}

export default function PaymentPlanBuilder({ 
  totalAmountCents, 
  paymentPlan, 
  onChange, 
  invoiceDueDate 
}: PaymentPlanBuilderProps) {
  const [localPlan, setLocalPlan] = useState(paymentPlan);

  useEffect(() => {
    setLocalPlan(paymentPlan);
  }, [paymentPlan]);

  const handlePlanTypeChange = (type: typeof paymentPlan.type) => {
    let newInstallments: PaymentPlanInstallment[] = [];
    
    if (type === 'full') {
      newInstallments = [{
        installment_number: 1,
        installment_label: 'Full Payment',
        amount_cents: totalAmountCents,
        due_date: invoiceDueDate || '',
        grace_period_days: 0
      }];
    } else if (type === '50_50') {
      const halfAmount = Math.round(totalAmountCents / 2);
      newInstallments = [
        {
          installment_number: 1,
          installment_label: 'First Payment (50%)',
          amount_cents: halfAmount,
          due_date: getDateOffset(invoiceDueDate, -30),
          grace_period_days: 3
        },
        {
          installment_number: 2,
          installment_label: 'Final Payment (50%)',
          amount_cents: totalAmountCents - halfAmount,
          due_date: invoiceDueDate || '',
          grace_period_days: 3
        }
      ];
    } else if (type === '40_30_30') {
      const firstAmount = Math.round(totalAmountCents * 0.4);
      const secondAmount = Math.round(totalAmountCents * 0.3);
      const finalAmount = totalAmountCents - firstAmount - secondAmount;
      
      newInstallments = [
        {
          installment_number: 1,
          installment_label: 'First Payment (40%)',
          amount_cents: firstAmount,
          due_date: getDateOffset(invoiceDueDate, -60),
          grace_period_days: 5
        },
        {
          installment_number: 2,
          installment_label: 'Second Payment (30%)',
          amount_cents: secondAmount,
          due_date: getDateOffset(invoiceDueDate, -30),
          grace_period_days: 3
        },
        {
          installment_number: 3,
          installment_label: 'Final Payment (30%)',
          amount_cents: finalAmount,
          due_date: invoiceDueDate || '',
          grace_period_days: 3
        }
      ];
    } else if (type === 'custom') {
      // Start with 2 installments for custom
      newInstallments = [
        {
          installment_number: 1,
          installment_label: 'Down Payment',
          amount_cents: Math.round(totalAmountCents * 0.5),
          due_date: getDateOffset(invoiceDueDate, -30),
          grace_period_days: 3
        },
        {
          installment_number: 2,
          installment_label: 'Final Payment',
          amount_cents: totalAmountCents - Math.round(totalAmountCents * 0.5),
          due_date: invoiceDueDate || '',
          grace_period_days: 3
        }
      ];
    }

    const newPlan = {
      enabled: type !== 'full',
      type,
      installments: newInstallments
    };

    setLocalPlan(newPlan);
    onChange(newPlan);
  };

  const getDateOffset = (dateStr: string | undefined, days: number): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  };

  const handleInstallmentChange = (index: number, field: keyof PaymentPlanInstallment, value: any) => {
    const newInstallments = [...localPlan.installments];
    newInstallments[index] = {
      ...newInstallments[index],
      [field]: field === 'amount_cents' ? Math.round(parseFloat(value || '0') * 100) : value
    };

    const newPlan = { ...localPlan, installments: newInstallments };
    setLocalPlan(newPlan);
    onChange(newPlan);
  };

  const addInstallment = () => {
    const newInstallment: PaymentPlanInstallment = {
      installment_number: localPlan.installments.length + 1,
      installment_label: `Payment ${localPlan.installments.length + 1}`,
      amount_cents: 0,
      due_date: invoiceDueDate || '',
      grace_period_days: 3
    };

    const newPlan = {
      ...localPlan,
      installments: [...localPlan.installments, newInstallment]
    };

    setLocalPlan(newPlan);
    onChange(newPlan);
  };

  const removeInstallment = (index: number) => {
    if (localPlan.installments.length <= 1) return;

    const newInstallments = localPlan.installments
      .filter((_, i) => i !== index)
      .map((installment, i) => ({
        ...installment,
        installment_number: i + 1
      }));

    const newPlan = { ...localPlan, installments: newInstallments };
    setLocalPlan(newPlan);
    onChange(newPlan);
  };

  const totalPlanned = localPlan.installments.reduce((sum, inst) => sum + inst.amount_cents, 0);
  const difference = totalAmountCents - totalPlanned;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Payment Plan</h3>
        
        {/* Payment Plan Type Selection */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
          {[
            { value: 'full', label: 'Full Payment' },
            { value: '50_50', label: '50/50 Split' },
            { value: '40_30_30', label: '40/30/30 Split' },
            { value: 'custom', label: 'Custom Plan' }
          ].map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => handlePlanTypeChange(option.value as any)}
              className={`p-3 text-sm font-medium rounded border-2 transition-colors ${
                localPlan.type === option.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payment Plan Details */}
      {localPlan.enabled && (
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-medium">Payment Installments</h4>
              {localPlan.type === 'custom' && (
                <button
                  type="button"
                  onClick={addInstallment}
                  className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                >
                  + Add Payment
                </button>
              )}
            </div>

            <div className="space-y-3">
              {localPlan.installments.map((installment, index) => (
                <div key={index} className="bg-white p-4 rounded border">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Payment Label
                      </label>
                      <input
                        type="text"
                        value={installment.installment_label}
                        onChange={(e) => handleInstallmentChange(index, 'installment_label', e.target.value)}
                        className="w-full text-sm border rounded px-2 py-1"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Amount ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={installment.amount_cents / 100}
                        onChange={(e) => handleInstallmentChange(index, 'amount_cents', e.target.value)}
                        className="w-full text-sm border rounded px-2 py-1"
                        disabled={localPlan.type !== 'custom'}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={installment.due_date}
                        onChange={(e) => handleInstallmentChange(index, 'due_date', e.target.value)}
                        className="w-full text-sm border rounded px-2 py-1"
                      />
                    </div>

                    <div className="flex items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Grace Days
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="30"
                          value={installment.grace_period_days}
                          onChange={(e) => handleInstallmentChange(index, 'grace_period_days', parseInt(e.target.value) || 0)}
                          className="w-full text-sm border rounded px-2 py-1"
                        />
                      </div>
                      
                      {localPlan.type === 'custom' && localPlan.installments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInstallment(index)}
                          className="ml-2 text-red-600 hover:text-red-800 text-sm px-2 py-1"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 p-3 bg-blue-50 rounded">
              <div className="flex justify-between text-sm">
                <span>Total Invoice:</span>
                <span className="font-medium">${(totalAmountCents / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Planned:</span>
                <span className={`font-medium ${difference !== 0 ? 'text-red-600' : 'text-green-600'}`}>
                  ${(totalPlanned / 100).toFixed(2)}
                </span>
              </div>
              {difference !== 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Difference:</span>
                  <span className="font-medium">${(Math.abs(difference) / 100).toFixed(2)} {difference > 0 ? 'missing' : 'over'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}