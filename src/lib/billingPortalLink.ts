/**
 * Signing helpers for the public billing-portal redirect endpoint.
 * Kept here (vs. inside the route file) so server-side code and the route
 * handler share canonical signing logic.
 */
import { createHmac, timingSafeEqual } from 'crypto';

const LINK_TTL_SECONDS = 14 * 24 * 60 * 60; // 14 days — covers a typical recovery window

function getSecret(): string {
  const secret =
    process.env.BILLING_PORTAL_LINK_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CRON_SECRET;
  if (!secret) {
    throw new Error(
      'No BILLING_PORTAL_LINK_SECRET / NEXTAUTH_SECRET / CRON_SECRET in env'
    );
  }
  return secret;
}

/**
 * Build a signed billing-portal permalink for a Stripe customer.
 * On click, the endpoint validates the signature, mints a FRESH Stripe
 * Customer Portal session, and 302-redirects there.
 */
export function buildBillingPortalLink(
  customerId: string,
  baseUrl: string = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com'
): string {
  const exp = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const sig = createHmac('sha256', getSecret())
    .update(`${customerId}:${exp}`)
    .digest('base64url');
  return `${baseUrl}/api/billing-portal/${encodeURIComponent(customerId)}?sig=${sig}&exp=${exp}`;
}

export function verifyBillingPortalSignature(
  customerId: string,
  exp: number,
  sig: string
): boolean {
  try {
    const expected = createHmac('sha256', getSecret())
      .update(`${customerId}:${exp}`)
      .digest('base64url');
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
