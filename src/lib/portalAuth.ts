import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'portal_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const TOKEN_EXPIRY_MINUTES = 15;

/**
 * Resolve the portal session signing secret. Fails closed: if no real secret is
 * configured we throw rather than fall back to a hardcoded value, which would
 * let anyone forge portal sessions. Evaluated lazily (not at module load) so a
 * missing env var during build can't break `next build`.
 */
function getSessionSecret(): Uint8Array {
  const secret = process.env.PORTAL_SESSION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'PORTAL_SESSION_SECRET (or NEXTAUTH_SECRET) must be set to sign portal sessions'
    );
  }
  return new TextEncoder().encode(secret);
}

let _adminClient: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _adminClient;
}

export interface PortalSession {
  portalUserId: string;
  clientId: string;
  email: string;
  clientName: string;
  /** Matched against client_portal_users.session_version on every verify. */
  sessionVersion: number;
}

export function generateMagicLinkToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function getTokenExpiry(): Date {
  return new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);
}

export async function createPortalSession(session: PortalSession): Promise<string> {
  const token = await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION}s`)
    .sign(getSessionSecret());

  return token;
}

export async function verifyPortalSession(token: string): Promise<PortalSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSessionSecret());
    const session: PortalSession = {
      portalUserId: payload.portalUserId as string,
      clientId: payload.clientId as string,
      email: payload.email as string,
      clientName: payload.clientName as string,
      sessionVersion: (payload.sessionVersion as number) ?? 0,
    };

    // The JWT is stateless, so re-validate it against the database on every use:
    // the user must still be active, and the token's session_version must match
    // the current one. Bumping session_version (e.g. on password change) is what
    // invalidates all previously issued tokens across other devices.
    const { data, error } = await adminClient()
      .from('client_portal_users')
      .select('session_version, is_active')
      .eq('id', session.portalUserId)
      .single();

    const user = data as { session_version: number | null; is_active: boolean | null } | null;

    if (error || !user || user.is_active === false) return null;
    if ((user.session_version ?? 0) !== session.sessionVersion) return null;

    return session;
  } catch {
    return null;
  }
}

export async function getPortalSessionFromCookie(): Promise<PortalSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  return verifyPortalSession(sessionCookie.value);
}

export async function setPortalSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION,
    path: '/',
  });
}

export async function clearPortalSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
