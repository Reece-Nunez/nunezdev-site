'use client';

import { useState, useMemo } from 'react';
import type { CreateInvoiceData, InvoiceLineItem, PaymentTerms, InvoiceTemplate } from '@/types/invoice';
import InvoiceTemplates from './InvoiceTemplates';
import InvoiceBuilderPreview from './InvoiceBuilderPreview';
import PaymentPlanBuilder, { PaymentPlanInstallment } from './PaymentPlanBuilder';

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
}

interface InvoiceBuilderProps {
  clients: Client[];
  initialData?: Partial<CreateInvoiceData>;
  onSave: (data: CreateInvoiceData) => void;
  onCancel: () => void;
  loading?: boolean;
}

const PAYMENT_TERMS_OPTIONS: { value: PaymentTerms; label: string }[] = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: '7', label: 'Net 7 days' },
  { value: '14', label: 'Net 14 days' },
  { value: '30', label: 'Net 30 days' },
  { value: '45', label: 'Net 45 days' },
  { value: '60', label: 'Net 60 days' },
  { value: '90', label: 'Net 90 days' },
];

export default function InvoiceBuilder({ 
  clients, 
  initialData, 
  onSave, 
  onCancel, 
  loading = false 
}: InvoiceBuilderProps) {
  const [formData, setFormData] = useState<CreateInvoiceData>({
    client_id: initialData?.client_id || '',
    title: initialData?.title || '',
    description: initialData?.description || '',
    notes: initialData?.notes || '',
    line_items: initialData?.line_items || [
      { title: '', description: '', quantity: 1.0, rate_cents: 7500, amount_cents: 7500 } // Default to $75.00
    ],
    payment_terms: initialData?.payment_terms || '30',
    require_signature: initialData?.require_signature ?? true,
    send_immediately: initialData?.send_immediately ?? false,
    brand_logo_url: initialData?.brand_logo_url || '/logo.png',
    brand_primary: initialData?.brand_primary || '#ffc312',
    // New enhanced fields
    project_overview: initialData?.project_overview || '',
    project_start_date: initialData?.project_start_date || '',
    delivery_date: initialData?.delivery_date || '',
    discount_type: initialData?.discount_type || 'percentage',
    discount_value: initialData?.discount_value || 0,
    technology_stack: initialData?.technology_stack || [],
    terms_conditions: initialData?.terms_conditions || '',
  });

  const [paymentPlan, setPaymentPlan] = useState({
    enabled: false,
    type: 'full' as 'full' | '50_50' | '40_30_30' | 'custom',
    installments: [] as PaymentPlanInstallment[]
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  
  // Track display values for rate inputs to avoid formatting issues
  const [rateDisplayValues, setRateDisplayValues] = useState<Record<number, string>>({
    0: '75.00' // Default for first line item
  });

  const handleTemplateSelect = (template: InvoiceTemplate) => {
    setFormData(prev => ({
      ...prev,
      title: template.name,
      line_items: template.line_items,
      payment_terms: template.payment_terms,
      notes: template.notes || '',
    }));
    
    // Update rate display values for template
    const newRateDisplayValues: Record<number, string> = {};
    template.line_items.forEach((item, index) => {
      if (item.rate_cents > 0) {
        newRateDisplayValues[index] = (item.rate_cents / 100).toString();
      }
    });
    setRateDisplayValues(newRateDisplayValues);
  };

  // Calculate totals
  const { subtotal, discount, tax, total } = useMemo(() => {
    const subtotal = formData.line_items.reduce((sum, item) => sum + item.amount_cents, 0);
    
    // Calculate discount
    let discount = 0;
    if (formData.discount_value && formData.discount_value > 0) {
      if (formData.discount_type === 'percentage') {
        discount = Math.round(subtotal * (formData.discount_value / 100));
      } else {
        discount = Math.round((formData.discount_value || 0) * 100); // Convert to cents
      }
    }
    
    const tax = 0; // TODO: Add tax calculation
    const total = subtotal - discount + tax;
    
    return { subtotal, discount, tax, total };
  }, [formData.line_items, formData.discount_type, formData.discount_value]);

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const newLineItems = [...formData.line_items];
    newLineItems[index] = { ...newLineItems[index], [field]: value };
    
    // Recalculate amount for quantity/rate changes
    if (field === 'quantity' || field === 'rate_cents') {
      const item = newLineItems[index];
      item.amount_cents = Math.round(item.quantity * item.rate_cents);
    }
    
    setFormData(prev => ({ ...prev, line_items: newLineItems }));
  };

  const updateLineItemRate = (index: number, dollarValue: string) => {
    // Update display value
    setRateDisplayValues(prev => ({ ...prev, [index]: dollarValue }));
    
    // Convert dollar string to cents, handling empty or invalid input
    const dollars = parseFloat(dollarValue) || 0;
    const cents = Math.round(dollars * 100);
    updateLineItem(index, 'rate_cents', cents);
  };

  const addLineItem = () => {
    const newIndex = formData.line_items.length;
    setFormData(prev => ({
      ...prev,
      line_items: [
        ...prev.line_items,
        { title: '', description: '', quantity: 1.0, rate_cents: 7500, amount_cents: 7500 } // Default to $75.00
      ]
    }));
    
    // Set default display value for new line item
    setRateDisplayValues(prev => ({ ...prev, [newIndex]: '75.00' }));
  };

  const removeLineItem = (index: number) => {
    if (formData.line_items.length > 1) {
      setFormData(prev => ({
        ...prev,
        line_items: prev.line_items.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.client_id) newErrors.client_id = 'Please select a client';
    if (!formData.title) newErrors.title = 'Invoice title is required';
    
    // Validate line items
    formData.line_items.forEach((item, index) => {
      if (!item.description) {
        newErrors[`line_item_${index}_description`] = 'Description is required';
      }
      if (typeof item.quantity !== 'number' || item.quantity < 0.25) {
        newErrors[`line_item_${index}_quantity`] = 'Hours must be 0.25 or greater';
      }
      if (item.rate_cents <= 0) {
        newErrors[`line_item_${index}_rate`] = 'Rate must be greater than 0';
      }
    });
    
    if (total <= 0) newErrors.total = 'Invoice total must be greater than $0';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const invoiceData = {
        ...formData,
        payment_plan_enabled: paymentPlan.enabled,
        payment_plan_type: paymentPlan.type,
        payment_plan_installments: paymentPlan.installments
      };
      onSave(invoiceData);
    }
  };

  const calculateDueDate = (paymentTerms: PaymentTerms): string => {
    const today = new Date();
    let daysToAdd = 30; // default
    
    switch (paymentTerms) {
      case 'due_on_receipt': daysToAdd = 0; break;
      case '7': daysToAdd = 7; break;
      case '14': daysToAdd = 14; break;
      case '30': daysToAdd = 30; break;
      case '45': daysToAdd = 45; break;
      case '60': daysToAdd = 60; break;
      case '90': daysToAdd = 90; break;
      default: daysToAdd = 30;
    }
    
    const dueDate = new Date(today);
    dueDate.setDate(dueDate.getDate() + daysToAdd);
    return dueDate.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  };

  const selectedClient = clients.find(c => c.id === formData.client_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Client & Basic Info */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Invoice Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Client <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.client_id}
              onChange={(e) => setFormData(prev => ({ ...prev, client_id: e.target.value }))}
              className={`w-full rounded-lg border px-3 py-2 ${errors.client_id ? 'border-red-300' : 'border-gray-300'}`}
            >
              <option value="">
                {clients.length === 0 ? 'Loading clients...' : 'Select a client...'}
              </option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.company ? `(${client.company})` : ''}
                </option>
              ))}
            </select>
            {errors.client_id && <p className="text-red-500 text-xs mt-1">{errors.client_id}</p>}
            {selectedClient && (
              <p className="text-gray-500 text-xs mt-1">{selectedClient.email}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              Invoice Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Web Development Services - Phase 1"
              className={`w-full rounded-lg border px-3 py-2 ${errors.title ? 'border-red-300' : 'border-gray-300'}`}
            />
            {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title}</p>}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the work or services provided..."
            rows={2}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Line Items</h2>
          <div className="flex gap-2">
            <InvoiceTemplates onSelectTemplate={handleTemplateSelect} />
            <button
              type="button"
              onClick={addLineItem}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              + Add Item
            </button>
          </div>
        </div>

        {/* Desktop Table - hidden on small screens */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left">Title & Description</th>
                <th className="px-3 py-2 text-center w-20">Hrs</th>
                <th className="px-3 py-2 text-right w-28">Rate</th>
                <th className="px-3 py-2 text-right w-28">Amount</th>
                <th className="px-3 py-2 text-center w-16">Actions</th>
              </tr>
            </thead>
            <tbody>
              {formData.line_items.map((item, index) => (
                <tr key={index} className="border-t">
                  <td className="px-3 py-2">
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={item.title || ''}
                        onChange={(e) => updateLineItem(index, 'title', e.target.value)}
                        placeholder="Short title (e.g., 'Frontend Development')"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-medium"
                      />
                      <textarea
                        value={item.description}
                        onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                        placeholder="Detailed description (e.g., 'React/Next.js implementation, responsive design, component architecture')"
                        rows={2}
                        className={`w-full rounded border px-2 py-1 text-sm resize-none ${
                          errors[`line_item_${index}_description`] ? 'border-red-300' : 'border-gray-300'
                        }`}
                      />
                      {errors[`line_item_${index}_description`] && (
                        <p className="text-red-500 text-xs mt-1">{errors[`line_item_${index}_description`]}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 1.0)}
                      className={`w-full rounded border px-2 py-1 text-sm text-center ${
                        errors[`line_item_${index}_quantity`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors[`line_item_${index}_quantity`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`line_item_${index}_quantity`]}</p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={rateDisplayValues[index] ?? (item.rate_cents > 0 ? (item.rate_cents / 100).toString() : '')}
                      onChange={(e) => updateLineItemRate(index, e.target.value)}
                      className={`w-full rounded border px-2 py-1 text-sm text-right ${
                        errors[`line_item_${index}_rate`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors[`line_item_${index}_rate`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`line_item_${index}_rate`]}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    ${(item.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {formData.line_items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(index)}
                        className="text-red-600 hover:text-red-800 text-xs"
                        title="Remove item"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards - visible on small screens */}
        <div className="lg:hidden space-y-4">
          {formData.line_items.map((item, index) => (
            <div key={index} className="border border-gray-300 rounded-lg p-4 bg-white w-full min-w-0">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Line Item {index + 1}</h3>
                {formData.line_items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLineItem(index)}
                    className="text-red-600 hover:text-red-800 text-sm px-2 py-1 rounded"
                    title="Remove item"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <input
                    type="text"
                    value={item.title || ''}
                    onChange={(e) => updateLineItem(index, 'title', e.target.value)}
                    placeholder="Short title (e.g., 'Frontend Development')"
                    className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                  <textarea
                    value={item.description}
                    onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                    placeholder="Detailed description of work..."
                    rows={3}
                    className={`w-full rounded border px-3 py-2 text-sm resize-none ${
                      errors[`line_item_${index}_description`] ? 'border-red-300' : 'border-gray-300'
                    }`}
                  />
                  {errors[`line_item_${index}_description`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`line_item_${index}_description`]}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hours</label>
                    <input
                      type="number"
                      min="0.25"
                      step="0.25"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 1.0)}
                      className={`w-full rounded border px-3 py-2 text-sm text-center ${
                        errors[`line_item_${index}_quantity`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors[`line_item_${index}_quantity`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`line_item_${index}_quantity`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rate ($)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={rateDisplayValues[index] ?? (item.rate_cents > 0 ? (item.rate_cents / 100).toString() : '')}
                      onChange={(e) => updateLineItemRate(index, e.target.value)}
                      className={`w-full rounded border px-3 py-2 text-sm text-right ${
                        errors[`line_item_${index}_rate`] ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {errors[`line_item_${index}_rate`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`line_item_${index}_rate`]}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <div className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-right bg-gray-50 font-medium">
                      ${(item.amount_cents / 100).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-4 border-t pt-4">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span>${(subtotal / 100).toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>
                    Discount {formData.discount_type === 'percentage' ? `(${formData.discount_value}%)` : ''}:
                  </span>
                  <span>-${(discount / 100).toFixed(2)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Tax:</span>
                  <span>${(tax / 100).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>${(total / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
        {errors.total && <p className="text-red-500 text-sm mt-2 text-right">{errors.total}</p>}
      </div>

      {/* Project Details */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Project Details</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Overview</label>
            <textarea
              value={formData.project_overview}
              onChange={(e) => setFormData(prev => ({ ...prev, project_overview: e.target.value }))}
              placeholder="Detailed description of the project, technologies used, and deliverables..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Project Start Date</label>
              <input
                type="date"
                value={formData.project_start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, project_start_date: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Delivery Date</label>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Discount Section */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Project Discount (Optional)</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium mb-1">Discount Type</label>
            <select
              value={formData.discount_type}
              onChange={(e) => setFormData(prev => ({ ...prev, discount_type: e.target.value as 'percentage' | 'fixed' }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount ($)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">
              {formData.discount_type === 'percentage' ? 'Percentage' : 'Amount ($)'}
            </label>
            <input
              type="number"
              min="0"
              step={formData.discount_type === 'percentage' ? '1' : '0.01'}
              max={formData.discount_type === 'percentage' ? '100' : undefined}
              value={formData.discount_value || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, discount_value: parseFloat(e.target.value) || 0 }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder={formData.discount_type === 'percentage' ? '0' : '0.00'}
            />
          </div>
          
          <div className="text-sm text-gray-600">
            {formData.discount_value && formData.discount_value > 0 ? (
              <div className="p-2 bg-green-50 rounded border border-green-200">
                <span className="text-green-700 font-medium">
                  Discount: ${(discount / 100).toFixed(2)}
                </span>
                <div className="text-xs text-green-600">
                  {formData.discount_type === 'percentage' 
                    ? `${formData.discount_value}% of subtotal`
                    : `Fixed amount`
                  }
                </div>
              </div>
            ) : (
              <div className="text-gray-400 text-xs">No discount applied</div>
            )}
          </div>
        </div>
      </div>

      {/* Technology Stack */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Technology Stack</h2>
        
        <div className="space-y-3">
          <p className="text-sm text-gray-600">List the technologies that will be used in this project:</p>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Supabase', 'Stripe', 'AWS Amplify', 'Framer Motion'].map((tech) => (
              <label key={tech} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.technology_stack?.includes(tech) || false}
                  onChange={(e) => {
                    const currentStack = formData.technology_stack || [];
                    if (e.target.checked) {
                      setFormData(prev => ({ 
                        ...prev, 
                        technology_stack: [...currentStack, tech] 
                      }));
                    } else {
                      setFormData(prev => ({ 
                        ...prev, 
                        technology_stack: currentStack.filter(t => t !== tech) 
                      }));
                    }
                  }}
                  className="rounded"
                />
                <span className="text-sm">{tech}</span>
              </label>
            ))}
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Custom Technologies</label>
            <input
              type="text"
              placeholder="Add custom technologies (comma-separated)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) {
                    const customTechs = value.split(',').map(t => t.trim()).filter(t => t);
                    const currentStack = formData.technology_stack || [];
                    const newStack = [...currentStack];
                    customTechs.forEach(tech => {
                      if (!newStack.includes(tech)) {
                        newStack.push(tech);
                      }
                    });
                    setFormData(prev => ({ ...prev, technology_stack: newStack }));
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-1">Press Enter to add custom technologies</p>
          </div>

          {formData.technology_stack && formData.technology_stack.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Selected Technologies:</p>
              <div className="flex flex-wrap gap-2">
                {formData.technology_stack.map((tech, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          technology_stack: prev.technology_stack?.filter(t => t !== tech)
                        }));
                      }}
                      className="text-blue-600 hover:text-blue-800 ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Enhanced Terms & Conditions */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Terms & Conditions</h2>
        
        {/* Default Terms Preview */}
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Default Terms (automatically included):</h3>
          <div className="text-sm text-gray-600 space-y-1">
            <div>• Payment is due within 30 days of invoice date</div>
            <div>• Late payments may be subject to a 1.5% monthly service charge</div>
            <div>• Please include invoice number with payment</div>
            <div>• This invoice requires a digital signature before payment</div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Additional Custom Terms & Conditions
          </label>
          <textarea
            value={formData.terms_conditions}
            onChange={(e) => setFormData(prev => ({ ...prev, terms_conditions: e.target.value }))}
            placeholder="Enter additional custom terms and conditions for this project...
            
Tip: Use bullet points with • or - for better formatting:
• Hosting: First year included
• Support: 30 days free support included
• Revisions: Up to 3 rounds included"
            rows={6}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            These custom terms will be displayed in addition to the default terms above
          </p>
        </div>
      </div>

      {/* Payment Plan */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <PaymentPlanBuilder
          totalAmountCents={total}
          paymentPlan={paymentPlan}
          onChange={setPaymentPlan}
          invoiceDueDate={calculateDueDate(formData.payment_terms)}
        />
      </div>

      {/* Payment Terms & Options */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Payment Terms & Options</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Payment Terms</label>
            <select
              value={formData.payment_terms}
              onChange={(e) => setFormData(prev => ({ ...prev, payment_terms: e.target.value as PaymentTerms }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {PAYMENT_TERMS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.require_signature}
                onChange={(e) => setFormData(prev => ({ ...prev, require_signature: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Require digital signature before payment</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.send_immediately}
                onChange={(e) => setFormData(prev => ({ ...prev, send_immediately: e.target.checked }))}
                className="rounded"
              />
              <span className="text-sm">Send immediately (bypass draft)</span>
            </label>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">Notes (visible to client)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Additional terms, project details, or notes for the client...

Use bullet points for better formatting:
• Timeline: Project completion in 4-6 weeks
• Communication: Weekly progress updates
• Files: Source code and assets delivered upon completion"
            rows={5}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>
      </div>

      {/* Branding */}
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Invoice Branding</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Logo URL</label>
            <input
              type="text"
              value={formData.brand_logo_url || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, brand_logo_url: e.target.value }))}
              placeholder="/logo.png"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">Path to your logo image (e.g., /logo.png or /reece-avatar.png)</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Primary Color</label>
            <div className="flex gap-2">
              <input
                type="color"
                value={formData.brand_primary || '#ffc312'}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_primary: e.target.value }))}
                className="w-12 h-10 rounded border border-gray-300"
              />
              <input
                type="text"
                value={formData.brand_primary || '#ffc312'}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_primary: e.target.value }))}
                placeholder="#ffc312"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">Color for accents and branding</p>
          </div>
        </div>

        {/* Brand Preview */}
        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
          <h3 className="text-sm font-medium mb-3 text-gray-700">Preview</h3>
          <div className="flex items-center gap-3 p-4 bg-white rounded border-b-2" 
               style={{ borderColor: formData.brand_primary || '#ffc312' }}>
            <img 
              src={formData.brand_logo_url || '/logo.png'} 
              alt="Logo Preview" 
              className="w-12 h-12 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div>
              <h4 className="font-bold text-lg" style={{ color: '#111111' }}>NunezDev</h4>
              <p className="text-sm text-gray-600">Professional Web Development Services</p>
            </div>
            <div className="ml-auto">
              <span className="text-2xl font-bold" style={{ color: formData.brand_primary || '#ffc312' }}>
                INVOICE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          disabled={loading || total <= 0}
          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          Preview
        </button>
        <button
          type="submit"
          disabled={loading || total <= 0}
          className="px-6 py-2 text-white rounded-lg disabled:opacity-50 transition-colors"
          style={{ 
            backgroundColor: formData.brand_primary || '#ffc312',
          }}
          onMouseEnter={(e) => {
            if (!loading && total > 0) {
              const color = formData.brand_primary || '#ffc312';
              (e.target as HTMLElement).style.backgroundColor = color === '#ffc312' ? '#e6ad0f' : color;
              (e.target as HTMLElement).style.filter = 'brightness(0.9)';
            }
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.backgroundColor = formData.brand_primary || '#ffc312';
            (e.target as HTMLElement).style.filter = 'brightness(1)';
          }}
        >
          {loading ? 'Creating...' : formData.send_immediately ? 'Create & Send Invoice' : 'Create Draft Invoice'}
        </button>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <InvoiceBuilderPreview
          invoiceData={formData}
          clients={clients}
          paymentPlan={paymentPlan}
          onClose={() => setShowPreview(false)}
        />
      )}
    </form>
  );
}