/**
 * PURE share helpers for agreements — URL builders, channel resolution, and the
 * default SMS body. No server-only imports (Twilio, Supabase), so this is safe
 * to import from client components (the dashboard list previews the SMS body).
 * The actual Twilio send lives in ./sms.ts, which imports from here.
 */

export type AgreementSendChannel = 'email' | 'sms' | 'both' | 'link';

/** Normalize an untrusted `channel` from the request body. Defaults to email. */
export function resolveAgreementChannel(raw: unknown): AgreementSendChannel {
  return raw === 'sms' || raw === 'both' || raw === 'link' ? raw : 'email';
}

export function agreementChannelWants(channel: AgreementSendChannel): {
  email: boolean;
  sms: boolean;
  link: boolean;
} {
  return {
    email: channel === 'email' || channel === 'both',
    sms: channel === 'sms' || channel === 'both',
    link: channel === 'link',
  };
}

/** Public, no-login URL for the agreement's token. `origin` is trailing-slash
 *  tolerant so window.location.origin or an env base URL both work. */
export function agreementPublicUrl(origin: string, token: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/agreement/${token}`;
}

/** Build the public agreement URL from a token using the configured base URL. */
export function agreementUrl(accessToken: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.nunezdev.com';
  return `${baseUrl}/agreement/${accessToken}`;
}

/**
 * Default SMS body for sharing an agreement link. Pure so both the send route
 * and the dashboard preview modal build the same message. House style: no em
 * dashes, link-forward, plain-spoken.
 */
export function buildAgreementShareMessage(p: {
  clientName?: string | null;
  title?: string | null;
  url: string;
}): string {
  const hi = p.clientName ? `Hi ${p.clientName}, ` : '';
  const what = p.title ? `the agreement "${p.title}"` : 'your agreement';
  return `${hi}here is ${what} from NunezDev. Please review and sign here: ${p.url}`;
}
