/**
 * Branded transactional emails for the auto-draft subscription flow.
 *
 * Every send is idempotent via subscription_email_log — webhook retries
 * cannot deliver the same notification twice. The send wrapper is the
 * single entry point all helpers use.
 *
 * Design: all emails share a base layout for brand consistency (NunezDev
 * yellow header, same footer). Only the body differs per email type.
 */
import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_ADDRESS = 'NunezDev <invoices@nunezdev.com>';
const SUPPORT_EMAIL = 'reece@nunezdev.com';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';

export type SubscriptionEmailType =
  | 'enrollment'
  | 'receipt'
  | 'payment_failed'
  | 'canceled'
  | 'card_expiring';

interface SendRecord {
  eventKey: string;
  emailType: SubscriptionEmailType;
  to: string;
  subject: string;
  html: string;
  orgId?: string | null;
  clientId?: string | null;
  stripeEventId?: string | null;
  metadata?: Record<string, unknown>;
}

interface SendResult {
  status: 'sent' | 'deduplicated' | 'skipped_no_resend' | 'failed';
  messageId?: string | null;
  error?: string;
}

/**
 * Send (or skip / retry) a branded subscription email — idempotent and replayable.
 *
 * Status machine on subscription_email_log:
 *   - insert as 'pending'  → attempt send  → on success update to 'sent'
 *                                          → on failure update to 'failed'
 *   - subsequent calls with the same event_key:
 *       row status='sent'    → skip (deduplicate)
 *       row status='pending' → retry send (previous attempt died mid-flight)
 *       row status='failed'  → retry send (Resend failed, webhook retry can fix)
 *
 * The pending → sent transition is the durable signal. A row stuck in
 * 'pending' or 'failed' is a recoverable error: any future webhook retry
 * for the same event will pick it up and try again.
 */
async function sendWithIdempotency(record: SendRecord): Promise<SendResult> {
  const supabase = supabaseAdmin();

  // Try to claim a fresh slot. Unique constraint on event_key makes this
  // race-safe — at most one INSERT wins.
  const { error: insertErr } = await supabase
    .from('subscription_email_log')
    .insert({
      event_key: record.eventKey,
      email_type: record.emailType,
      to_email: record.to,
      org_id: record.orgId ?? null,
      client_id: record.clientId ?? null,
      stripe_event_id: record.stripeEventId ?? null,
      metadata: record.metadata ?? {},
      status: 'pending',
    });

  if (insertErr && insertErr.code === '23505') {
    // Row exists. Inspect status to decide whether to skip or retry.
    const { data: existing } = await supabase
      .from('subscription_email_log')
      .select('status')
      .eq('event_key', record.eventKey)
      .single();
    if (existing?.status === 'sent') {
      return { status: 'deduplicated' };
    }
    // pending or failed — fall through to attempt send below.
  } else if (insertErr) {
    console.error('[subscription-email] log insert failed', insertErr);
    return { status: 'failed', error: insertErr.message };
  }

  if (!resend) {
    // Dev path: mark as sent so dev runs don't leave perpetual pending rows.
    await supabase
      .from('subscription_email_log')
      .update({ status: 'sent' })
      .eq('event_key', record.eventKey);
    console.log('[subscription-email] (no RESEND_API_KEY) would send', {
      to: record.to,
      subject: record.subject,
      eventKey: record.eventKey,
    });
    return { status: 'skipped_no_resend' };
  }

  try {
    const result = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [record.to],
      subject: record.subject,
      html: record.html,
    });
    const messageId = result.data?.id ?? null;
    await supabase
      .from('subscription_email_log')
      .update({ status: 'sent', resend_message_id: messageId ?? null })
      .eq('event_key', record.eventKey);
    return { status: 'sent', messageId };
  } catch (err) {
    console.error('[subscription-email] resend.send failed', err);
    await supabase
      .from('subscription_email_log')
      .update({ status: 'failed' })
      .eq('event_key', record.eventKey);
    return {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ---------------------------------------------------------------------------
// HTML template helpers — keeps every email visually consistent.
// ---------------------------------------------------------------------------

interface Cta {
  label: string;
  url: string;
  primary?: boolean;
}

function renderLayout({
  heading,
  bodyHtml,
  ctas,
}: {
  heading: string;
  bodyHtml: string;
  ctas?: Cta[];
}): string {
  const ctaHtml = (ctas || [])
    .map(
      (c) => `
        <a href="${c.url}" style="display:inline-block;padding:14px 28px;margin:8px 8px 8px 0;
          border-radius:6px;text-decoration:none;font-weight:500;
          background:${c.primary ? '#ffc312' : '#5b7c99'};
          color:${c.primary ? '#111' : '#fff'};">
          ${c.label}
        </a>`
    )
    .join('');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#222;line-height:1.55;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f4f5f7;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:#ffc312;padding:18px 24px;text-align:center;">
            <img src="${BASE_URL}/logo.png" alt="NunezDev" width="48" height="48" style="display:block;margin:0 auto 6px;">
            <div style="font-size:18px;font-weight:600;color:#111;">NunezDev</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 28px 20px;">
            <h1 style="margin:0 0 16px;font-size:20px;color:#111;">${heading}</h1>
            ${bodyHtml}
            ${ctaHtml ? `<div style="margin-top:20px;">${ctaHtml}</div>` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px 28px;border-top:1px solid #eee;font-size:12px;color:#666;">
            Questions? Reply to this email or reach me at
            <a href="mailto:${SUPPORT_EMAIL}" style="color:#5b7c99;">${SUPPORT_EMAIL}</a>.
            <br>
            Reece Nunez · NunezDev
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function fmtMoney(cents: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

function fmtDate(d: Date | string | number | null): string {
  if (d === null) return '';
  const dt = typeof d === 'number' ? new Date(d * 1000) : new Date(d);
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Public senders. Each builds the HTML + delegates to sendWithIdempotency.
// ---------------------------------------------------------------------------

export async function sendEnrollmentConfirmation(params: {
  to: string;
  clientName: string;
  productName: string;
  amountCents: number;
  currency: string;
  interval: string;
  intervalCount: number;
  nextChargeAt: Date | number | null;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  orgId: string;
  clientId: string;
  stripeEventId: string;
}): Promise<SendResult> {
  const intervalLabel =
    params.intervalCount === 1
      ? params.interval
      : `${params.intervalCount} ${params.interval}s`;

  const body = `
    <p>Hi ${params.clientName},</p>
    <p>You're all set up for auto-pay on <strong>${params.productName}</strong>.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8f9fa;border-radius:6px;width:100%;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:13px;color:#666;">Amount</div>
        <div style="font-size:18px;font-weight:600;">${fmtMoney(params.amountCents, params.currency)} / ${intervalLabel}</div>
        ${params.nextChargeAt ? `
        <div style="margin-top:10px;font-size:13px;color:#666;">Next charge</div>
        <div style="font-size:15px;font-weight:500;">${fmtDate(params.nextChargeAt)}</div>` : ''}
      </td></tr>
    </table>
    <p>I'll email you a receipt after every successful charge. You can update your card or cancel anytime — just reply to this email and I'll help.</p>
  `;

  return sendWithIdempotency({
    eventKey: `enrollment:${params.stripeSubscriptionId}`,
    emailType: 'enrollment',
    to: params.to,
    subject: `You're set up for auto-pay — ${params.productName}`,
    html: renderLayout({ heading: 'Auto-pay confirmed', bodyHtml: body }),
    orgId: params.orgId,
    clientId: params.clientId,
    stripeEventId: params.stripeEventId,
    metadata: {
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_customer_id: params.stripeCustomerId,
    },
  });
}

export async function sendSubscriptionReceipt(params: {
  to: string;
  clientName: string;
  productName: string;
  amountPaidCents: number;
  currency: string;
  paidAt: Date | number;
  invoicePdfUrl: string | null;
  hostedInvoiceUrl: string | null;
  cardLast4: string | null;
  cardBrand: string | null;
  stripeInvoiceId: string;
  stripeSubscriptionId: string;
  orgId: string;
  clientId: string;
  stripeEventId: string;
}): Promise<SendResult> {
  const cardLine =
    params.cardBrand && params.cardLast4
      ? `${params.cardBrand.toUpperCase()} ending in ${params.cardLast4}`
      : 'card on file';

  const ctas: Cta[] = [];
  if (params.hostedInvoiceUrl) {
    ctas.push({ label: 'View receipt', url: params.hostedInvoiceUrl, primary: true });
  } else if (params.invoicePdfUrl) {
    ctas.push({ label: 'Download PDF', url: params.invoicePdfUrl, primary: true });
  }

  const body = `
    <p>Hi ${params.clientName},</p>
    <p>This confirms your auto-pay charge for <strong>${params.productName}</strong> has been received. Thank you!</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8f9fa;border-radius:6px;width:100%;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:13px;color:#666;">Amount charged</div>
        <div style="font-size:20px;font-weight:600;color:#0a7a3d;">${fmtMoney(params.amountPaidCents, params.currency)}</div>
        <div style="margin-top:10px;font-size:13px;color:#666;">Charged on</div>
        <div style="font-size:14px;">${fmtDate(params.paidAt)}</div>
        <div style="margin-top:10px;font-size:13px;color:#666;">Payment method</div>
        <div style="font-size:14px;">${cardLine}</div>
      </td></tr>
    </table>
  `;

  return sendWithIdempotency({
    eventKey: `receipt:${params.stripeInvoiceId}`,
    emailType: 'receipt',
    to: params.to,
    subject: `Payment received — ${fmtMoney(params.amountPaidCents, params.currency)} for ${params.productName}`,
    html: renderLayout({ heading: 'Payment received', bodyHtml: body, ctas }),
    orgId: params.orgId,
    clientId: params.clientId,
    stripeEventId: params.stripeEventId,
    metadata: {
      stripe_invoice_id: params.stripeInvoiceId,
      stripe_subscription_id: params.stripeSubscriptionId,
    },
  });
}

export async function sendSubscriptionPaymentFailed(params: {
  to: string;
  clientName: string;
  productName: string;
  amountCents: number;
  currency: string;
  attemptCount: number;
  nextAttemptAt: Date | number | null;
  cardBrand: string | null;
  cardLast4: string | null;
  updatePaymentUrl: string | null;
  stripeInvoiceId: string;
  stripeSubscriptionId: string;
  orgId: string;
  clientId: string;
  stripeEventId: string;
}): Promise<SendResult> {
  const cardLine =
    params.cardBrand && params.cardLast4
      ? `${params.cardBrand.toUpperCase()} ending in ${params.cardLast4}`
      : 'card on file';

  const retryLine = params.nextAttemptAt
    ? `<p>I'll automatically try again on <strong>${fmtDate(params.nextAttemptAt)}</strong>. Updating your card now will help the next attempt succeed.</p>`
    : `<p>I won't make additional automatic attempts. If your card has changed, update it below and I'll re-run the charge manually.</p>`;

  const ctas: Cta[] = [];
  if (params.updatePaymentUrl) {
    ctas.push({ label: 'Update payment method', url: params.updatePaymentUrl, primary: true });
  }

  const body = `
    <p>Hi ${params.clientName},</p>
    <p>I couldn't charge your ${cardLine} for <strong>${params.productName}</strong> today.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#fff5f5;border-radius:6px;width:100%;border:1px solid #fecaca;">
      <tr><td style="padding:14px 16px;">
        <div style="font-size:13px;color:#666;">Amount due</div>
        <div style="font-size:20px;font-weight:600;color:#b91c1c;">${fmtMoney(params.amountCents, params.currency)}</div>
        <div style="margin-top:10px;font-size:13px;color:#666;">Attempts so far</div>
        <div style="font-size:14px;">${params.attemptCount}</div>
      </td></tr>
    </table>
    ${retryLine}
  `;

  return sendWithIdempotency({
    eventKey: `payment_failed:${params.stripeInvoiceId}`,
    emailType: 'payment_failed',
    to: params.to,
    subject: `Action needed — payment declined for ${params.productName}`,
    html: renderLayout({ heading: 'We couldn’t process your payment', bodyHtml: body, ctas }),
    orgId: params.orgId,
    clientId: params.clientId,
    stripeEventId: params.stripeEventId,
    metadata: {
      stripe_invoice_id: params.stripeInvoiceId,
      stripe_subscription_id: params.stripeSubscriptionId,
      attempt_count: params.attemptCount,
    },
  });
}

export async function sendSubscriptionCanceled(params: {
  to: string;
  clientName: string;
  productName: string;
  reason: 'unpaid' | 'requested' | 'other';
  stripeSubscriptionId: string;
  orgId: string;
  clientId: string;
  stripeEventId: string;
}): Promise<SendResult> {
  const reasonLine = (() => {
    switch (params.reason) {
      case 'unpaid':
        return `<p>Your auto-pay subscription for <strong>${params.productName}</strong> was canceled after several failed payment attempts. No further charges will occur.</p>
                <p>Reply to this email and we'll get you set up with a working card so you can stay enrolled.</p>`;
      case 'requested':
        return `<p>Your auto-pay subscription for <strong>${params.productName}</strong> has been canceled at your request. No further charges will occur.</p>`;
      default:
        return `<p>Your auto-pay subscription for <strong>${params.productName}</strong> has been canceled. No further charges will occur.</p>`;
    }
  })();

  const body = `
    <p>Hi ${params.clientName},</p>
    ${reasonLine}
    <p>Thanks for using NunezDev — I appreciate your business.</p>
  `;

  return sendWithIdempotency({
    eventKey: `canceled:${params.stripeSubscriptionId}`,
    emailType: 'canceled',
    to: params.to,
    subject: `Subscription canceled — ${params.productName}`,
    html: renderLayout({ heading: 'Subscription canceled', bodyHtml: body }),
    orgId: params.orgId,
    clientId: params.clientId,
    stripeEventId: params.stripeEventId,
    metadata: { stripe_subscription_id: params.stripeSubscriptionId, reason: params.reason },
  });
}
