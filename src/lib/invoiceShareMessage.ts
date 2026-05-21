/**
 * Single source of truth for the message we use when sharing an invoice
 * link with a client (SMS, share sheet, manual copy, combine flow).
 *
 * Lived in 4 places before centralization (per Phase 7 QC audit):
 *   - src/app/dashboard/invoices/[id]/page.tsx (SMS modal default + Share Link)
 *   - src/components/invoices/CombineInvoicesModal.tsx (post-combine share)
 *   - src/lib/invoiceSms.ts (server-side default body)
 * One edit anywhere risked drift across channels. Now: change here, all four
 * channels pick it up.
 *
 * Format constraints worth preserving:
 *   - Stays in one Twilio segment (160 chars) for short amounts + short
 *     access tokens (~$500 retainer + URL ≈ 110 chars).
 *   - First-name greeting (not "Hi there") whenever a name is available.
 *   - Always ends with the URL so SMS clients render it as a preview.
 */

const firstName = (full: string | null | undefined): string => {
  if (!full) return 'there';
  return full.split(/\s+/)[0] || 'there';
};

const fmtMoney = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
};

export function buildInvoiceShareMessage(params: {
  clientName: string | null | undefined;
  amountCents: number;
  url: string;
}): string {
  return `Hi ${firstName(params.clientName)}, your NunezDev invoice for ${fmtMoney(
    params.amountCents
  )} is ready: ${params.url}`;
}
