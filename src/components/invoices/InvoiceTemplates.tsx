'use client';

import { useState } from 'react';
import type { InvoiceLineItem, InvoiceTemplate } from '@/types/invoice';

function getPaymentTermsDisplay(terms: string): string {
  switch (terms) {
    case 'due_on_receipt': return 'Due on receipt';
    case '7': return 'Net 7 days';
    case '14': return 'Net 14 days';
    case '30': return 'Net 30 days';
    case '45': return 'Net 45 days';
    case '60': return 'Net 60 days';
    case '90': return 'Net 90 days';
    default: return `Net ${terms} days`;
  }
}

interface InvoiceTemplatesProps {
  onSelectTemplate: (template: InvoiceTemplate) => void;
}

const DEFAULT_TEMPLATES: InvoiceTemplate[] = [
  {
    id: 'web_dev_basic',
    name: 'Web Development - Basic Package',
    payment_terms: '30',
    line_items: [
      {
        description: 'Website Design & Development',
        quantity: 1,
        rate_cents: 250000, // $2,500
        amount_cents: 250000,
      },
      {
        description: 'Content Management System Setup',
        quantity: 1,
        rate_cents: 50000, // $500
        amount_cents: 50000,
      },
      {
        description: 'SEO Optimization',
        quantity: 1,
        rate_cents: 30000, // $300
        amount_cents: 30000,
      },
    ],
    notes: 'Includes responsive design, mobile optimization, and basic SEO setup.',
  },
  {
    id: 'web_dev_advanced',
    name: 'Web Development - Advanced',
    payment_terms: '30',
    line_items: [
      {
        description: 'Custom Web Application Development',
        quantity: 40,
        rate_cents: 15000, // $150/hour
        amount_cents: 600000, // $6,000
      },
      {
        description: 'Database Design & Integration',
        quantity: 8,
        rate_cents: 17500, // $175/hour
        amount_cents: 140000, // $1,400
      },
      {
        description: 'API Development & Integration',
        quantity: 12,
        rate_cents: 16000, // $160/hour
        amount_cents: 192000, // $1,920
      },
      {
        description: 'Testing & Quality Assurance',
        quantity: 8,
        rate_cents: 12500, // $125/hour
        amount_cents: 100000, // $1,000
      },
    ],
    notes: 'Full-stack web application with custom functionality, database integration, and comprehensive testing.',
  },
  {
    id: 'consulting',
    name: 'Consulting Services',
    payment_terms: '14',
    line_items: [
      {
        description: 'Technical Consulting',
        quantity: 10,
        rate_cents: 20000, // $200/hour
        amount_cents: 200000, // $2,000
      },
      {
        description: 'Code Review & Architecture Analysis',
        quantity: 1,
        rate_cents: 150000, // $1,500
        amount_cents: 150000,
      },
    ],
    notes: 'Professional technical consulting and code review services.',
  },
  {
    id: 'maintenance',
    name: 'Monthly Maintenance',
    payment_terms: '30',
    line_items: [
      {
        description: 'Website Maintenance & Updates',
        quantity: 1,
        rate_cents: 50000, // $500/month
        amount_cents: 50000,
      },
      {
        description: 'Security Monitoring & Backups',
        quantity: 1,
        rate_cents: 25000, // $250/month
        amount_cents: 25000,
      },
      {
        description: 'Performance Optimization',
        quantity: 1,
        rate_cents: 15000, // $150/month
        amount_cents: 15000,
      },
    ],
    notes: 'Monthly maintenance package including security updates, backups, and performance monitoring.',
  },
];

export default function InvoiceTemplates({ onSelectTemplate }: InvoiceTemplatesProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSelectTemplate = (template: InvoiceTemplate) => {
    onSelectTemplate(template);
    setShowTemplates(false);
  };

  if (!showTemplates) {
    return (
      <button
        type="button"
        onClick={() => setShowTemplates(true)}
        className="text-sm text-blue-600 hover:underline"
      >
        📋 Use Template
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-lg bg-white">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Choose Invoice Template</h2>
          <button
            onClick={() => setShowTemplates(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          {DEFAULT_TEMPLATES.map((template) => {
            const total = template.line_items.reduce((sum, item) => sum + item.amount_cents, 0);
            
            return (
              <div
                key={template.id}
                className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                style={{ 
                  borderLeft: `4px solid #ffc312`
                }}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{template.name}</h3>
                  <span className="font-bold" style={{ color: '#ffc312' }}>
                    ${(total / 100).toLocaleString()}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  Payment Terms: {getPaymentTermsDisplay(template.payment_terms)}
                </div>

                <div className="space-y-1 mb-3">
                  {template.line_items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm">
                      <span className="text-gray-700">
                        {item.quantity > 1 ? `${item.quantity}x ` : ''}{item.description}
                      </span>
                      <span className="font-medium">
                        ${(item.amount_cents / 100).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {template.notes && (
                  <div className="text-sm text-gray-500 italic">
                    {template.notes}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t p-4 bg-gray-50">
          <p className="text-sm text-gray-600 text-center">
            Select a template to pre-fill your invoice, or close to start from scratch.
          </p>
        </div>
      </div>
    </div>
  );
}