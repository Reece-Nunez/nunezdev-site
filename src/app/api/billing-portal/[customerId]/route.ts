/**
 * PUBLIC endpoint — short-lived, HMAC-signed Stripe Customer Portal redirect.
 *
 * Emails (payment failed, etc.) include a link like:
 *   /api/billing-portal/cus_xxx?sig=<base64url-hmac>&exp=<unix-seconds>
 *
 * On click:
 *   1. Validate exp (link expires after 14 days)
 *   2. Validate HMAC(customer_id + ":" + exp) against env secret
 *   3. Generate a FRESH Stripe Customer Portal session
 *   4. 302 redirect to the Stripe-hosted portal
 *
 * This solves the staleness problem: pre-generating the portal URL at email
 * send time would give the client a URL that expires in ~3 hours. By making
 * a signed permalink that mints fresh sessions on click, the link stays
 * valid for the email's useful lifetime.
 */
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyBillingPortalSignature } from '@/lib/billingPortalLink';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function errorPage(message: string, status: number): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  const escaped = message.replace(/[&<>]/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'
  );
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Billing portal</title>
     <style>body{font-family:-apple-system,sans-serif;max-width:480px;margin:48px auto;padding:24px;color:#222;line-height:1.5}
     h1{font-size:20px;margin-bottom:12px}a{color:#5b7c99}</style></head>
     <body><h1>This link can't be opened</h1><p>${escaped}</p>
     <p>Reply to your most recent invoice email and we'll send you a fresh link.</p>
     <p><a href="${baseUrl}">← Back to NunezDev</a></p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(
  req: Request,
  context: { params: Promise<{ customerId: string }> }
) {
  const { customerId } = await context.params;
  const url = new URL(req.url);
  const sig = url.searchParams.get('sig');
  const expStr = url.searchParams.get('exp');

  if (!customerId || !customerId.startsWith('cus_')) {
    return errorPage('Invalid customer id.', 400);
  }
  if (!sig || !expStr) {
    return errorPage('Link is missing required parameters.', 400);
  }

  const exp = Number(expStr);
  if (!Number.isFinite(exp)) {
    return errorPage('Invalid link.', 400);
  }
  if (exp < Math.floor(Date.now() / 1000)) {
    return errorPage('This link has expired.', 410);
  }
  if (!verifyBillingPortalSignature(customerId, exp, sig)) {
    return errorPage('Invalid signature.', 403);
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return errorPage('Billing not configured. Please contact NunezDev.', 500);
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: baseUrl,
    });
    return NextResponse.redirect(session.url, { status: 302 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    if (message.includes('No configuration provided')) {
      return errorPage(
        "Stripe Customer Portal isn't configured yet. Please contact NunezDev.",
        500
      );
    }
    console.error('[billing-portal] redirect failed', err);
    return errorPage(
      "We couldn't open the billing portal right now. Please try again in a few minutes.",
      500
    );
  }
}
