/**
 * Thumbtack Partner Platform API client — server-side.
 *
 * Auth model: the supply-side resource endpoints (associate phone numbers,
 * outbound messages) are gated on the OAuth2 **authorization_code** grant
 * against Thumbtack's Hydra server. We confirmed this the hard way — a
 * client_credentials token request for the NunezDev client returns
 * `unauthorized_client` ("not allowed to use grant client_credentials"), and
 * the published OpenAPI spec lists every `supply::` scope (incl.
 * associate-phone-numbers) ONLY under the authorizationCode flow
 * (clientCredentials exposes demand:: scopes only).
 *
 * So the flow is:
 *   1. Owner consents once at GET /api/thumbtack  (buildAuthorizeUrl, PKCE).
 *   2. GET /api/thumbtack/callback exchanges the code for access+refresh tokens
 *      (exchangeAuthorizationCode) and persists them (persistThumbtackTokens).
 *   3. This client reads the stored access token, refreshing via the
 *      refresh-token grant when it expires (getThumbtackAccessToken), and sends
 *      it as `Authorization: Bearer <token>`.
 *
 * Docs:
 *   https://developers.thumbtack.com/docs/getting-started/authentication
 *   https://developers.thumbtack.com/docs/getting-started/environments
 *   https://developers.thumbtack.com/docs/pro-integrations/phone-numbers
 *   OpenAPI: https://api.thumbtack.com/docs/thumbtack_api_latest.json
 *
 * Relative `./supabaseAdmin` import (not `@/…`) on purpose: scripts/…mjs runs
 * this outside Next via tsx, and the tsx test runner doesn't resolve `@/`.
 * No `server-only` import for the same reason. Never import into a client
 * component — it reads THUMBTACK_CLIENT_SECRET and account tokens.
 */
import { supabaseAdmin } from './supabaseAdmin';

export type ThumbtackEnv = 'production' | 'staging';

export interface ThumbtackConfig {
  env: ThumbtackEnv;
  apiHost: string; // e.g. https://api.thumbtack.com
  authorizeUrl: string; // Hydra authorize endpoint
  tokenUrl: string; // Hydra token endpoint
  clientId: string;
  clientSecret: string;
  scopes: string; // space-delimited resource scopes (offline_access added at consent)
}

export interface ThumbtackPhoneNumber {
  phoneNumberID: string;
  businessID: string;
  phoneNumber: string;
  createdTime: string;
  updatedTime?: string;
  lastActivityTime?: string;
  isDeleted?: boolean;
  name?: string;
}

/** Raw token response from Hydra's /oauth2/token (exchange or refresh). */
export interface ThumbtackTokenResponse {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  expires_in?: number;
}

// Per Thumbtack "Environments": each environment has its own hosts *and* its
// own client credentials. Authorize/token hosts confirmed from the OpenAPI spec.
const HOSTS: Record<ThumbtackEnv, Pick<ThumbtackConfig, 'apiHost' | 'authorizeUrl' | 'tokenUrl'>> = {
  production: {
    apiHost: 'https://api.thumbtack.com',
    authorizeUrl: 'https://auth.thumbtack.com/oauth2/auth',
    tokenUrl: 'https://auth.thumbtack.com/oauth2/token',
  },
  staging: {
    apiHost: 'https://staging-api.thumbtack.com',
    authorizeUrl: 'https://staging-auth.thumbtack.com/oauth2/auth',
    tokenUrl: 'https://staging-auth.thumbtack.com/oauth2/token',
  },
};

// Tokens are minted for the partner-API audience.
export const TOKEN_AUDIENCE = 'urn:partner-api';

// Exact scopes from the OpenAPI spec's per-operation `security`.
// Phone numbers: read -> list; write -> create/update/delete/bulk.
export const THUMBTACK_PHONE_SCOPES =
  'supply::businesses/associate-phone-numbers.read supply::businesses/associate-phone-numbers.write';
// Messages: read -> list a negotiation's messages; write -> send (the instant
// new-lead auto-reply). sendMessageV4 requires supply::messages.write.
export const THUMBTACK_MESSAGE_SCOPES = 'supply::messages.read supply::messages.write';

// The scope set requested at consent by default — everything this app calls, so
// one owner consent covers phone-number management AND messaging. Override with
// THUMBTACK_API_SCOPES only to narrow/extend.
export const THUMBTACK_DEFAULT_SCOPES = `${THUMBTACK_PHONE_SCOPES} ${THUMBTACK_MESSAGE_SCOPES}`;

// Thumbtack's PhoneNumber schema: E.164 restricted to US/North American
// numbers, i.e. `+1` followed by up to 14 more digits.
const E164_US = /^\+1\d{1,14}$/;

// Access token expiry safety margin: refresh this many ms before actual expiry
// so a token can't lapse mid-request.
const EXPIRY_MARGIN_MS = 60_000;

const nowMs = () => Date.now();

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export function resolveThumbtackEnv(raw = process.env.THUMBTACK_ENV): ThumbtackEnv {
  // Default to staging: the safer first target. Set THUMBTACK_ENV=production
  // once verified.
  return raw === 'production' ? 'production' : 'staging';
}

/**
 * Resolve config from an env bag (defaults to process.env). Read lazily so a
 * CLI can populate process.env (via @next/env) before the first call.
 */
export function resolveThumbtackConfig(
  env: Record<string, string | undefined> = process.env
): ThumbtackConfig {
  const ttEnv = resolveThumbtackEnv(env.THUMBTACK_ENV);
  const hosts = HOSTS[ttEnv];

  // Staging and production use separate credentials. Prefer env-specific vars;
  // fall back to the generic pair so a single-environment setup still works.
  const clientId =
    (ttEnv === 'staging' ? env.THUMBTACK_STAGING_CLIENT_ID : env.THUMBTACK_CLIENT_ID) ||
    env.THUMBTACK_CLIENT_ID ||
    '';
  const clientSecret =
    (ttEnv === 'staging' ? env.THUMBTACK_STAGING_CLIENT_SECRET : env.THUMBTACK_CLIENT_SECRET) ||
    env.THUMBTACK_CLIENT_SECRET ||
    '';
  // Resource scopes to request at consent; defaults to the phone-number scopes.
  // Override THUMBTACK_API_SCOPES to add other routes (offline_access is added
  // automatically by buildAuthorizeUrl).
  const scopes = (env.THUMBTACK_API_SCOPES || THUMBTACK_DEFAULT_SCOPES).trim();

  return { env: ttEnv, ...hosts, clientId, clientSecret, scopes };
}

/** Client id/secret are needed for the token exchange + refresh (Basic auth). */
function assertClientConfig(cfg: ThumbtackConfig): void {
  const missing: string[] = [];
  if (!cfg.clientId) missing.push(cfg.env === 'staging' ? 'THUMBTACK_STAGING_CLIENT_ID' : 'THUMBTACK_CLIENT_ID');
  if (!cfg.clientSecret) missing.push(cfg.env === 'staging' ? 'THUMBTACK_STAGING_CLIENT_SECRET' : 'THUMBTACK_CLIENT_SECRET');
  if (missing.length) {
    throw new Error(`Thumbtack not configured for env "${cfg.env}": set ${missing.join(', ')}`);
  }
}

function basicAuthHeader(cfg: ThumbtackConfig): string {
  return `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64')}`;
}

// ---------------------------------------------------------------------------
// Phone-number helpers (pure)
// ---------------------------------------------------------------------------

export function isValidThumbtackPhone(phone: string): boolean {
  return E164_US.test(phone);
}

/** Coerce common US phone inputs to the E.164 shape Thumbtack requires. */
export function normalizeThumbtackPhone(input: string): string | null {
  const trimmed = String(input).trim();
  if (E164_US.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * Path for the associate-phone-numbers resource (Thumbtack's name for business
 * phone numbers). Version is v4; the `${apiHost}/api` prefix is added by the
 * fetch helper so the full URL is e.g. https://api.thumbtack.com/api/v4/...
 */
export function associatePhoneNumbersPath(
  businessID: string | number,
  phoneNumberID?: string | number
): string {
  const base = `/api/v4/businesses/${businessID}/associate-phone-numbers`;
  return phoneNumberID == null ? base : `${base}/${phoneNumberID}`;
}

// ---------------------------------------------------------------------------
// OAuth request builders (pure — unit-tested without network)
// ---------------------------------------------------------------------------

/** Space-delimited consent scopes = resource scopes + offline_access (deduped). */
function consentScopes(cfg: ThumbtackConfig): string {
  const set = new Set(cfg.scopes.split(/\s+/).filter(Boolean));
  set.add('offline_access'); // required to receive a refresh token
  return Array.from(set).join(' ');
}

export function buildAuthorizeUrl(
  cfg: ThumbtackConfig,
  params: { redirectUri: string; state: string; codeChallenge: string }
): string {
  const qs = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: params.redirectUri,
    response_type: 'code',
    scope: consentScopes(cfg),
    audience: TOKEN_AUDIENCE,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${cfg.authorizeUrl}?${qs.toString()}`;
}

interface TokenHttpRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export function buildTokenExchangeRequest(
  cfg: ThumbtackConfig,
  params: { code: string; redirectUri: string; codeVerifier: string }
): TokenHttpRequest {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  return {
    url: cfg.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader(cfg) },
    body: body.toString(),
  };
}

export function buildRefreshRequest(cfg: ThumbtackConfig, refreshToken: string): TokenHttpRequest {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return {
    url: cfg.tokenUrl,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader(cfg) },
    body: body.toString(),
  };
}

export function computeExpiresAtMs(expiresInSec: number | undefined, now = nowMs()): number {
  const secs = typeof expiresInSec === 'number' && expiresInSec > 0 ? expiresInSec : 3600;
  return now + secs * 1000;
}

/** True if the token is within the safety margin of (or past) its expiry. */
export function isAccessTokenExpired(expiresAtMs: number, now = nowMs()): boolean {
  return expiresAtMs - EXPIRY_MARGIN_MS <= now;
}

// ---------------------------------------------------------------------------
// Token store + acquisition
// ---------------------------------------------------------------------------

interface StoredTokenRow {
  org_id: string;
  access_token: string;
  refresh_token: string | null;
  scope: string | null;
  token_type: string | null;
  expires_at: string;
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return '<no body>';
  }
}

/**
 * Read the stored token for an org, or (when orgId is omitted, e.g. the CLI)
 * the most recently updated one. NunezDev is single-tenant, so "most recent"
 * resolves the single connection.
 */
async function readStoredToken(orgId?: string): Promise<StoredTokenRow | null> {
  const base = supabaseAdmin().from('thumbtack_oauth_tokens').select('*');
  const { data, error } = orgId
    ? await base.eq('org_id', orgId).limit(1)
    : await base.order('updated_at', { ascending: false }).limit(1);
  if (error) throw new Error(`failed to read thumbtack tokens: ${error.message}`);
  return (data?.[0] as StoredTokenRow | undefined) ?? null;
}

/**
 * Upsert tokens for an org. On refresh, Hydra may or may not rotate the refresh
 * token; if the response omits it, keep `previousRefreshToken`.
 */
export async function persistThumbtackTokens(
  orgId: string,
  tok: ThumbtackTokenResponse,
  previousRefreshToken?: string | null
): Promise<void> {
  const row = {
    org_id: orgId,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? previousRefreshToken ?? null,
    scope: tok.scope ?? null,
    token_type: tok.token_type ?? null,
    expires_at: new Date(computeExpiresAtMs(tok.expires_in)).toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabaseAdmin()
    .from('thumbtack_oauth_tokens')
    .upsert(row, { onConflict: 'org_id' });
  if (error) throw new Error(`failed to persist thumbtack tokens: ${error.message}`);
}

/** Exchange an authorization code for tokens (called by the callback route). */
export async function exchangeAuthorizationCode(
  cfg: ThumbtackConfig,
  params: { code: string; redirectUri: string; codeVerifier: string }
): Promise<ThumbtackTokenResponse> {
  assertClientConfig(cfg);
  const req = buildTokenExchangeRequest(cfg, params);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (!res.ok) {
    throw new Error(`Thumbtack code exchange failed (${res.status}): ${await safeText(res)}`);
  }
  return (await res.json()) as ThumbtackTokenResponse;
}

async function refreshAccessToken(
  cfg: ThumbtackConfig,
  refreshToken: string
): Promise<ThumbtackTokenResponse> {
  const req = buildRefreshRequest(cfg, refreshToken);
  const res = await fetch(req.url, { method: 'POST', headers: req.headers, body: req.body });
  if (!res.ok) {
    throw new Error(`Thumbtack token refresh failed (${res.status}): ${await safeText(res)}`);
  }
  return (await res.json()) as ThumbtackTokenResponse;
}

interface TokenOpts {
  cfg?: ThumbtackConfig;
  orgId?: string;
}

// Small in-process cache so we don't read the DB on every API call. Keyed by
// env + org so staging/prod and multiple orgs don't clobber each other.
const memCache = new Map<string, { accessToken: string; expiresAtMs: number }>();

/** Drop the in-memory access-token cache — for tests and manual recovery. */
export function clearThumbtackTokenCache(): void {
  memCache.clear();
}

/**
 * Return a valid Bearer access token for the connected org: cache -> stored
 * token -> refresh. Throws a clear "not connected"/"re-consent" error if there
 * is no usable token, so callers surface the need to (re)run the consent flow.
 */
export async function getThumbtackAccessToken(opts: TokenOpts = {}): Promise<string> {
  const cfg = opts.cfg ?? resolveThumbtackConfig();
  assertClientConfig(cfg);

  const key = `${cfg.env}:${opts.orgId ?? 'default'}`;
  const cached = memCache.get(key);
  if (cached && !isAccessTokenExpired(cached.expiresAtMs)) return cached.accessToken;

  const row = await readStoredToken(opts.orgId);
  if (!row) {
    throw new Error(
      'Thumbtack not connected: the org owner must consent at /api/thumbtack before calling the API.'
    );
  }

  const expiresAtMs = new Date(row.expires_at).getTime();
  if (!isAccessTokenExpired(expiresAtMs)) {
    memCache.set(key, { accessToken: row.access_token, expiresAtMs });
    return row.access_token;
  }

  if (!row.refresh_token) {
    throw new Error(
      'Thumbtack access token expired and no refresh token is stored; the owner must re-consent at /api/thumbtack.'
    );
  }

  const refreshed = await refreshAccessToken(cfg, row.refresh_token);
  await persistThumbtackTokens(row.org_id, refreshed, row.refresh_token);
  const newExpiry = computeExpiresAtMs(refreshed.expires_in);
  memCache.set(key, { accessToken: refreshed.access_token, expiresAtMs: newExpiry });
  return refreshed.access_token;
}

async function thumbtackApiFetch<T>(path: string, init: RequestInit, opts: TokenOpts = {}): Promise<T> {
  const cfg = opts.cfg ?? resolveThumbtackConfig();
  const token = await getThumbtackAccessToken({ cfg, orgId: opts.orgId });
  const res = await fetch(`${cfg.apiHost}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(
      `Thumbtack API ${init.method || 'GET'} ${path} failed (${res.status}): ${await safeText(res)}`
    );
  }

  // DELETE (and some PUTs) can return 204 with no body.
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ---------------------------------------------------------------------------
// Associate phone numbers — CRUD
// ---------------------------------------------------------------------------

export async function createAssociatePhoneNumber(
  businessID: string | number,
  input: { phoneNumber: string; name?: string },
  opts?: TokenOpts
): Promise<ThumbtackPhoneNumber> {
  if (!isValidThumbtackPhone(input.phoneNumber)) {
    throw new Error(`phoneNumber must be E.164 US format (^\\+1\\d{1,14}$); got "${input.phoneNumber}"`);
  }
  return thumbtackApiFetch<ThumbtackPhoneNumber>(
    associatePhoneNumbersPath(businessID),
    { method: 'POST', body: JSON.stringify(input) },
    opts
  );
}

/**
 * Register several numbers in one request via the bulk-create endpoint.
 * Validates every number up front so one bad entry fails the batch before any
 * network call.
 */
export async function bulkCreateAssociatePhoneNumbers(
  businessID: string | number,
  phoneNumbers: Array<{ phoneNumber: string; name?: string }>,
  opts?: TokenOpts
): Promise<{ phoneNumbers: ThumbtackPhoneNumber[] }> {
  for (const entry of phoneNumbers) {
    if (!isValidThumbtackPhone(entry.phoneNumber)) {
      throw new Error(`phoneNumber must be E.164 US format (^\\+1\\d{1,14}$); got "${entry.phoneNumber}"`);
    }
  }
  return thumbtackApiFetch<{ phoneNumbers: ThumbtackPhoneNumber[] }>(
    `/api/v4/businesses/${businessID}/associate-phone-numbers-bulk-create`,
    { method: 'POST', body: JSON.stringify({ phoneNumbers }) },
    opts
  );
}

export async function listAssociatePhoneNumbers(
  businessID: string | number,
  opts?: TokenOpts
): Promise<ThumbtackPhoneNumber[]> {
  const data = await thumbtackApiFetch<{ phoneNumbers?: ThumbtackPhoneNumber[] }>(
    associatePhoneNumbersPath(businessID),
    { method: 'GET' },
    opts
  );
  return data?.phoneNumbers ?? [];
}

export async function updateAssociatePhoneNumber(
  businessID: string | number,
  phoneNumberID: string | number,
  input: { phoneNumber?: string; name?: string },
  opts?: TokenOpts
): Promise<ThumbtackPhoneNumber> {
  if (input.phoneNumber != null && !isValidThumbtackPhone(input.phoneNumber)) {
    throw new Error(`phoneNumber must be E.164 US format (^\\+1\\d{1,14}$); got "${input.phoneNumber}"`);
  }
  return thumbtackApiFetch<ThumbtackPhoneNumber>(
    associatePhoneNumbersPath(businessID, phoneNumberID),
    { method: 'PUT', body: JSON.stringify(input) },
    opts
  );
}

export async function deleteAssociatePhoneNumber(
  businessID: string | number,
  phoneNumberID: string | number,
  opts?: TokenOpts
): Promise<void> {
  await thumbtackApiFetch<void>(
    associatePhoneNumbersPath(businessID, phoneNumberID),
    { method: 'DELETE' },
    opts
  );
}

// ---------------------------------------------------------------------------
// Messages (negotiation threads)
// ---------------------------------------------------------------------------

// Thumbtack's message `text` field: required, 1..16384 chars (from the spec).
const MESSAGE_MAX_LEN = 16384;

export interface ThumbtackSentMessage {
  messageID?: string;
  negotiationID?: string;
  text?: string;
  [key: string]: unknown;
}

/**
 * Send a message into a negotiation (lead thread) — the outbound leg of the
 * instant new-lead auto-reply. Requires the supply::messages.write scope.
 * Trims and length-checks up front so an empty/oversized body fails before any
 * network call.
 */
export async function sendThumbtackMessage(
  negotiationID: string,
  text: string,
  opts?: TokenOpts
): Promise<ThumbtackSentMessage> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) throw new Error('sendThumbtackMessage: text is required');
  if (trimmed.length > MESSAGE_MAX_LEN) {
    throw new Error(`sendThumbtackMessage: text exceeds ${MESSAGE_MAX_LEN} chars`);
  }
  return thumbtackApiFetch<ThumbtackSentMessage>(
    `/api/v4/negotiations/${negotiationID}/messages`,
    { method: 'POST', body: JSON.stringify({ text: trimmed }) },
    opts
  );
}

/** List a negotiation's messages (supply::messages.read) — for verification. */
export async function listThumbtackMessages(
  negotiationID: string,
  opts?: TokenOpts
): Promise<ThumbtackSentMessage[]> {
  const data = await thumbtackApiFetch<{ messages?: ThumbtackSentMessage[] }>(
    `/api/v4/negotiations/${negotiationID}/messages`,
    { method: 'GET' },
    opts
  );
  return data?.messages ?? [];
}
