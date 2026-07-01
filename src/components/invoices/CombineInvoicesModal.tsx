'use client';

import { useEffect, useState } from 'react';
import { buildInvoiceShareMessage } from '@/lib/invoiceShareMessage';

export type DeliveryMethod = 'email' | 'sms' | 'both' | 'manual';

export interface CombineResult {
  publicUrl: string;
  invoiceNumber: string;
  amountCents: number;
  clientName: string;
}

interface Invoice {
  id: string;
  invoice_number?: string;
  title?: string;
  amount_cents: number;
  status: string;
  issued_at?: string;
  clients?: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
  };
}

interface CombineInvoicesModalProps {
  invoices: Invoice[];
  /**
   * Triggered when the operator confirms. The parent calls the combine
   * endpoint and resolves with the result (so the modal can show a
   * post-submit share-link view for the 'manual' delivery method).
   * For non-manual methods the parent still resolves, but the modal
   * just closes via onCancel.
   */
  onConfirm: (opts: { delivery_method: DeliveryMethod; sms_to?: string }) => Promise<CombineResult | null>;
  onCancel: () => void;
  loading?: boolean;
}

export default function CombineInvoicesModal({
  invoices,
  onConfirm,
  onCancel,
  loading = false,
}: CombineInvoicesModalProps) {
  const [error, setError] = useState<string | null>(null);

  const combinedTotal = invoices.reduce((sum, inv) => sum + inv.amount_cents, 0);
  const client = invoices[0]?.clients;
  const phoneOnFile = client?.phone || '';

  // Default to email — the safe, established channel. Admin opts into SMS
  // explicitly so we don't surprise-text anyone.
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('email');
  const [smsPhone, setSmsPhone] = useState(phoneOnFile);
  // Holds the post-success result for delivery_method='manual' so we can
  // show the share-link panel inside the same modal.
  const [shareResult, setShareResult] = useState<CombineResult | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  useEffect(() => {
    setSmsPhone(phoneOnFile);
  }, [phoneOnFile]);

  const wantSms = deliveryMethod === 'sms' || deliveryMethod === 'both';
  const wantEmail = deliveryMethod === 'email' || deliveryMethod === 'both';
  const wantManual = deliveryMethod === 'manual';

  const handleConfirm = async () => {
    setError(null);
    if (wantSms && !smsPhone.trim()) {
      setError('Phone number required when sending via text.');
      return;
    }
    try {
      const result = await onConfirm({
        delivery_method: deliveryMethod,
        sms_to: wantSms ? smsPhone.trim() : undefined,
      });
      // For 'manual' delivery, keep the modal open and show the share UI.
      if (wantManual && result?.publicUrl) {
        setShareResult(result);
      }
      // For email/sms/both the parent closes the modal via onCancel after
      // the toast shows — no extra UI from us.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to combine invoices');
    }
  };

  // Share / copy the new combined invoice link.
  const handleShare = async () => {
    if (!shareResult) return;
    const message = buildInvoiceShareMessage({
      clientName: shareResult.clientName,
      amountCents: shareResult.amountCents,
      url: shareResult.publicUrl,
    });

    // Mobile: native share sheet (opens Messages directly on iOS)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `Invoice ${shareResult.invoiceNumber}`,
          text: message,
          url: shareResult.publicUrl,
        });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // fall through to clipboard copy
      }
    }
    try {
      await navigator.clipboard.writeText(message);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setError('Could not copy automatically. Select the link below and copy manually.');
    }
  };

  const handleCopyLinkOnly = async () => {
    if (!shareResult) return;
    try {
      await navigator.clipboard.writeText(shareResult.publicUrl);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setError('Could not copy automatically.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={loading ? undefined : onCancel}
      />

      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Combine Invoices</h2>
              <p className="text-sm text-gray-500">Create a single invoice from multiple</p>
            </div>
          </div>
        </div>

        {shareResult ? (
          <>
            <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
              <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-900">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">
                    Combined into {shareResult.invoiceNumber}
                  </span>
                </div>
                <p className="text-sm text-emerald-800 mt-1">
                  {invoices.length} invoices voided. Share the link below — nothing was emailed or texted.
                </p>
              </div>

              <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
                Invoice link
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  readOnly
                  value={shareResult.publicUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono bg-gray-50"
                />
                <button
                  type="button"
                  onClick={handleCopyLinkOnly}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-100"
                  title="Copy just the URL"
                >
                  {copyState === 'copied' ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share with full message
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                On mobile: opens iMessage / native share sheet.
                On desktop: copies a pre-formatted message + link to clipboard.
              </p>

              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <>
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto">
          {client && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Client</p>
              <p className="text-gray-900">{client.name}</p>
              <p className="text-sm text-gray-500">{client.email}</p>
              {phoneOnFile && (
                <p className="text-sm text-gray-500">{phoneOnFile}</p>
              )}
            </div>
          )}

          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">
              Invoices to combine ({invoices.length})
            </p>
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-white"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {invoice.invoice_number || `INV-${invoice.id.split('-')[0]}`}
                    </p>
                    <p className="text-sm text-gray-500">
                      {invoice.title || 'Invoice'}
                      {invoice.issued_at && (
                        <span className="ml-2">
                          • {new Date(invoice.issued_at).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900">
                      ${(invoice.amount_cents / 100).toFixed(2)}
                    </p>
                    <p className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                      invoice.status === 'overdue' ? 'bg-red-100 text-red-700' :
                      invoice.status === 'sent' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {invoice.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-blue-900">Combined Total</span>
              <span className="text-2xl font-bold text-blue-600">
                ${(combinedTotal / 100).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Delivery method selector */}
          <div className="mb-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Delivery</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['email', 'sms', 'both', 'manual'] as const).map((m) => {
                const disabled = (m === 'sms' || m === 'both') && !phoneOnFile && !smsPhone.trim();
                const active = deliveryMethod === m;
                const label =
                  m === 'email' ? 'Email' :
                  m === 'sms' ? 'Text' :
                  m === 'both' ? 'Both' :
                  'Share link';
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={loading}
                    onClick={() => setDeliveryMethod(m)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    } ${disabled && !active ? 'opacity-60' : ''}`}
                    title={
                      disabled && !active
                        ? 'No phone on file — enter one below to enable'
                        : m === 'manual'
                        ? 'Combine the invoices and give me the link — I\'ll share it myself'
                        : undefined
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {wantManual && (
              <p className="text-xs text-gray-500 mt-1">
                Combines the invoices and gives you the link. Nothing is emailed or texted.
              </p>
            )}
          </div>

          {/* Phone input only relevant when SMS is involved */}
          {wantSms && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone number for text
              </label>
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                disabled={loading}
                placeholder="(405) 555-1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
              {!phoneOnFile && (
                <p className="text-xs text-amber-600 mt-1">
                  No phone on file for this client — enter one above (and add it to their
                  client record so it pre-fills next time).
                </p>
              )}
            </div>
          )}

          {/* Confirmation — what's about to happen */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex gap-2">
              <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="text-sm text-amber-800">
                <p className="font-medium">Original invoices will be voided</p>
                <p className="mt-1 text-amber-700">
                  The {invoices.length} selected invoices will be marked void.
                  {wantManual ? (
                    <> A new combined invoice will be created and you&apos;ll get a link to share.</>
                  ) : (
                    <>
                      {' '}A new combined invoice will be created and sent via{' '}
                      <strong>
                        {wantEmail && wantSms ? 'email + text' : wantEmail ? 'email' : 'text'}
                      </strong>.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || (wantSms && !smsPhone.trim())}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Combining...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                {wantManual ? 'Combine & Get Link' : 'Combine & Send'}
              </>
            )}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
