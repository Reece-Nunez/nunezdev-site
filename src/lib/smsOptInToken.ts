/**
 * Signed magic-link tokens for one-time SMS opt-in outreach.
 *
 * We send each existing client an email with a link like
 * `/sms-opt-in/<token>`. The token is a JWT signed with the portal
 * session secret (no new secret to manage) carrying just clientId. The
 * landing page validates the token and presents a click-to-confirm UI;
 * clicking confirm records consent server-side with the token's payload
 * as the source.
 *
 * Tokens expire in 30 days. Anyone who lets it expire can opt in later
 * via the portal toggle.
 */
import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.PORTAL_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'fallback-secret-change-me',
);

const TTL = '30d';

export async function signSmsOptInToken(clientId: string): Promise<string> {
  return new SignJWT({ clientId, purpose: 'sms_opt_in' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TTL)
    .sign(SECRET);
}

export async function verifySmsOptInToken(
  token: string,
): Promise<{ clientId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== 'sms_opt_in') return null;
    if (typeof payload.clientId !== 'string') return null;
    return { clientId: payload.clientId };
  } catch {
    return null;
  }
}
