'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { MetricDetail } from '@/lib/analytics';

interface ClickableMetricProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'gray' | 'red' | 'purple';
  details: MetricDetail[];
  subtitle?: string;
}

const colorClasses = {
  green: {
    bg: 'bg-green-100',
    text: 'text-green-600',
    iconBg: 'bg-green-100',
    iconText: 'text-green-600'
  },
  blue: {
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    iconBg: 'bg-blue-100',
    iconText: 'text-blue-600'
  },
  gray: {
    bg: 'bg-gray-100',
    text: 'text-gray-800',
    iconBg: 'bg-gray-100',
    iconText: 'text-gray-600'
  },
  red: {
    bg: 'bg-red-100',
    text: 'text-red-600',
    iconBg: 'bg-red-100',
    iconText: 'text-red-600'
  },
  purple: {
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    iconBg: 'bg-purple-100',
    iconText: 'text-purple-600'
  }
};

export default function ClickableMetric({ title, value, icon, color, details, subtitle }: ClickableMetricProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = colorClasses[color];


  const formatCurrency = (cents: number) =>
    (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'USD' });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  const getTypeIcon = (type: MetricDetail['type']) => {
    switch (type) {
      case 'payment':
        return '💳';
      case 'invoice':
        return '📄';
      case 'deal':
        return '🤝';
      default:
        return '📊';
    }
  };

  return (
    <>
      <div
        className={`rounded-xl border bg-white p-4 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${colors.bg} hover:${colors.bg}`}
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">{title}</p>
            <p className={`text-2xl font-bold ${colors.text}`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 ${colors.iconBg} rounded-lg`}>
            <div className={`w-6 h-6 ${colors.iconText}`}>
              {icon}
            </div>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          Click to view {(details || []).length} item{(details || []).length !== 1 ? 's' : ''}
        </div>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`p-2 ${colors.iconBg} rounded-lg`}>
                <div className={`w-6 h-6 ${colors.iconText}`}>
                  {icon}
                </div>
              </div>
              {title} - {value}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {(details || []).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No data available</p>
            ) : (
              (details || []).map((detail) => (
                <div key={detail.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{getTypeIcon(detail.type)}</span>
                    <div>
                      <p className="font-medium text-sm">{detail.label}</p>
                      {detail.description && (
                        <p className="text-xs text-gray-500">{detail.description}</p>
                      )}
                      {detail.status && (
                        <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                          detail.status === 'paid' ? 'bg-green-100 text-green-700' :
                          detail.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                          detail.status === 'overdue' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {detail.status}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(detail.amount)}</p>
                    <p className="text-xs text-gray-500">{formatDate(detail.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {(details || []).length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Total Items</p>
                  <p className="font-semibold">{(details || []).length}</p>
                </div>
                <div>
                  <p className="text-gray-500">Total Amount</p>
                  <p className="font-semibold">
                    {formatCurrency((details || []).reduce((sum, d) => sum + d.amount, 0))}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Average</p>
                  <p className="font-semibold">
                    {formatCurrency((details || []).length > 0 ? (details || []).reduce((sum, d) => sum + d.amount, 0) / (details || []).length : 0)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Latest</p>
                  <p className="font-semibold">
                    {(details || []).length > 0 ? formatDate((details || [])[0].date) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}