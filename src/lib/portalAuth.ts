import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const PORTAL_SESSION_SECRET = new TextEncoder().encode(
  process.env.PORTAL_SESSION_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-secret-change-me'
);

const COOKIE_NAME = 'portal_session';
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 days in seconds
const TOKEN_EXPIRY_MINUTES = 15;

export interface PortalSession {
  portalUserId: string;
  clientId: string;
  email: string;
  clientName: string;
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
    .sign(PORTAL_SESSION_SECRET);

  return token;
}

export async function verifyPortalSession(token: string): Promise<PortalSession | null> {
  try {
    const { payload } = await jwtVerify(token, PORTAL_SESSION_SECRET);
    return {
      portalUserId: payload.portalUserId as string,
      clientId: payload.clientId as string,
      email: payload.email as string,
      clientName: payload.clientName as string,
    };
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
