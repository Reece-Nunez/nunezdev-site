/**
 * Unit tests for the Thumbtack Partner Platform API client. Run with:
 *
 *   npm test
 *
 * Pure logic + a swapped-out global.fetch. No real network or DB. These pin:
 *   - environment/credential resolution (staging is the safe default)
 *   - E.164 validation matching Thumbtack's PhoneNumber schema
 *   - the OAuth2 authorization_code request shapes (authorize URL, code
 *     exchange, refresh) and access-token expiry math
 *   - that a bad phone number is rejected BEFORE any request is made
 *
 * Token acquisition itself (getThumbtackAccessToken) is DB-backed and covered by
 * the request-builder + expiry seams rather than a live store.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveThumbtackEnv,
  resolveThumbtackConfig,
  isValidThumbtackPhone,
  normalizeThumbtackPhone,
  associatePhoneNumbersPath,
  buildAuthorizeUrl,
  buildTokenExchangeRequest,
  buildRefreshRequest,
  computeExpiresAtMs,
  isAccessTokenExpired,
  createAssociatePhoneNumber,
  bulkCreateAssociatePhoneNumbers,
  sendThumbtackMessage,
  THUMBTACK_PHONE_SCOPES,
  THUMBTACK_MESSAGE_SCOPES,
  THUMBTACK_DEFAULT_SCOPES,
  TOKEN_AUDIENCE,
  type ThumbtackConfig,
} from './thumbtackApi';

const TEST_CFG: ThumbtackConfig = {
  env: 'staging',
  apiHost: 'https://staging-api.thumbtack.com',
  authorizeUrl: 'https://staging-auth.thumbtack.com/oauth2/auth',
  tokenUrl: 'https://staging-auth.thumbtack.com/oauth2/token',
  clientId: 'id',
  clientSecret: 'secret',
  scopes: THUMBTACK_PHONE_SCOPES,
};

describe('resolveThumbtackEnv', () => {
  it('defaults to staging (the safe first target)', () => {
    assert.equal(resolveThumbtackEnv(undefined), 'staging');
    assert.equal(resolveThumbtackEnv(''), 'staging');
    assert.equal(resolveThumbtackEnv('nonsense'), 'staging');
  });

  it('honors an explicit production value', () => {
    assert.equal(resolveThumbtackEnv('production'), 'production');
  });
});

describe('resolveThumbtackConfig', () => {
  it('maps staging to staging hosts and prefers staging creds', () => {
    const cfg = resolveThumbtackConfig({
      THUMBTACK_ENV: 'staging',
      THUMBTACK_STAGING_CLIENT_ID: 'stg-id',
      THUMBTACK_STAGING_CLIENT_SECRET: 'stg-secret',
      THUMBTACK_CLIENT_ID: 'prod-id',
      THUMBTACK_CLIENT_SECRET: 'prod-secret',
    });
    assert.equal(cfg.env, 'staging');
    assert.equal(cfg.apiHost, 'https://staging-api.thumbtack.com');
    assert.equal(cfg.authorizeUrl, 'https://staging-auth.thumbtack.com/oauth2/auth');
    assert.equal(cfg.tokenUrl, 'https://staging-auth.thumbtack.com/oauth2/token');
    assert.equal(cfg.clientId, 'stg-id');
    assert.equal(cfg.clientSecret, 'stg-secret');
  });

  it('falls back to the generic credential pair when no staging-specific vars', () => {
    const cfg = resolveThumbtackConfig({
      THUMBTACK_ENV: 'staging',
      THUMBTACK_CLIENT_ID: 'generic-id',
      THUMBTACK_CLIENT_SECRET: 'generic-secret',
    });
    assert.equal(cfg.clientId, 'generic-id');
    assert.equal(cfg.clientSecret, 'generic-secret');
  });

  it('maps production to production hosts', () => {
    const cfg = resolveThumbtackConfig({
      THUMBTACK_ENV: 'production',
      THUMBTACK_CLIENT_ID: 'prod-id',
      THUMBTACK_CLIENT_SECRET: 'prod-secret',
    });
    assert.equal(cfg.env, 'production');
    assert.equal(cfg.apiHost, 'https://api.thumbtack.com');
    assert.equal(cfg.authorizeUrl, 'https://auth.thumbtack.com/oauth2/auth');
    assert.equal(cfg.tokenUrl, 'https://auth.thumbtack.com/oauth2/token');
  });

  it('defaults resource scopes to phone + messages; honors an override', () => {
    const scopes = resolveThumbtackConfig({}).scopes;
    assert.equal(scopes, THUMBTACK_DEFAULT_SCOPES);
    // Default must cover both the phone-number and messaging routes so one
    // consent unlocks both features.
    assert.ok(scopes.includes(THUMBTACK_PHONE_SCOPES));
    assert.ok(scopes.includes(THUMBTACK_MESSAGE_SCOPES));
    assert.equal(resolveThumbtackConfig({ THUMBTACK_API_SCOPES: '  supply::x  ' }).scopes, 'supply::x');
  });
});

describe('isValidThumbtackPhone / normalizeThumbtackPhone', () => {
  it('accepts a US E.164 number', () => {
    assert.equal(isValidThumbtackPhone('+14055551234'), true);
  });

  it('rejects non-E.164 / non-US shapes', () => {
    assert.equal(isValidThumbtackPhone('4055551234'), false); // no +1
    assert.equal(isValidThumbtackPhone('+445551234'), false); // not +1
    assert.equal(isValidThumbtackPhone('+1'), false); // no national number
    assert.equal(isValidThumbtackPhone('+1 (405) 555-1234'), false); // punctuation
  });

  it('normalizes common US inputs to E.164', () => {
    assert.equal(normalizeThumbtackPhone('4055551234'), '+14055551234');
    assert.equal(normalizeThumbtackPhone('(405) 555-1234'), '+14055551234');
    assert.equal(normalizeThumbtackPhone('1-405-555-1234'), '+14055551234');
    assert.equal(normalizeThumbtackPhone('+14055551234'), '+14055551234');
  });

  it('returns null on unnormalizable input', () => {
    assert.equal(normalizeThumbtackPhone('555-1234'), null); // too short
    assert.equal(normalizeThumbtackPhone('not a phone'), null);
  });
});

describe('associatePhoneNumbersPath', () => {
  it('builds the collection path', () => {
    assert.equal(
      associatePhoneNumbersPath('553306875926847497'),
      '/api/v4/businesses/553306875926847497/associate-phone-numbers'
    );
  });

  it('builds the item path when a phoneNumberID is given', () => {
    assert.equal(
      associatePhoneNumbersPath('553306875926847497', '5343987659230309812'),
      '/api/v4/businesses/553306875926847497/associate-phone-numbers/5343987659230309812'
    );
  });
});

describe('buildAuthorizeUrl', () => {
  it('assembles the Hydra authorize URL with PKCE + offline_access', () => {
    const url = new URL(
      buildAuthorizeUrl(TEST_CFG, {
        redirectUri: 'https://www.nunezdev.com/api/thumbtack/callback',
        state: 'st8',
        codeChallenge: 'chal',
      })
    );
    assert.equal(url.origin + url.pathname, 'https://staging-auth.thumbtack.com/oauth2/auth');
    const p = url.searchParams;
    assert.equal(p.get('client_id'), 'id');
    assert.equal(p.get('redirect_uri'), 'https://www.nunezdev.com/api/thumbtack/callback');
    assert.equal(p.get('response_type'), 'code');
    assert.equal(p.get('audience'), TOKEN_AUDIENCE);
    assert.equal(p.get('state'), 'st8');
    assert.equal(p.get('code_challenge'), 'chal');
    assert.equal(p.get('code_challenge_method'), 'S256');
    // Scope must carry both phone scopes plus offline_access (for a refresh token).
    const scopes = (p.get('scope') || '').split(' ');
    assert.ok(scopes.includes('supply::businesses/associate-phone-numbers.read'));
    assert.ok(scopes.includes('supply::businesses/associate-phone-numbers.write'));
    assert.ok(scopes.includes('offline_access'));
  });

  it('does not duplicate offline_access when already present in scopes', () => {
    const cfg = { ...TEST_CFG, scopes: 'supply::x offline_access' };
    const url = new URL(buildAuthorizeUrl(cfg, { redirectUri: 'r', state: 's', codeChallenge: 'c' }));
    const offlineCount = (url.searchParams.get('scope') || '').split(' ').filter((s) => s === 'offline_access').length;
    assert.equal(offlineCount, 1);
  });
});

describe('buildTokenExchangeRequest / buildRefreshRequest', () => {
  const expectedBasic = 'Basic ' + Buffer.from('id:secret').toString('base64');

  it('builds an authorization_code exchange with Basic auth + PKCE verifier', () => {
    const req = buildTokenExchangeRequest(TEST_CFG, {
      code: 'the-code',
      redirectUri: 'https://www.nunezdev.com/api/thumbtack/callback',
      codeVerifier: 'verifier',
    });
    assert.equal(req.url, 'https://staging-auth.thumbtack.com/oauth2/token');
    assert.equal(req.headers.Authorization, expectedBasic);
    assert.equal(req.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const body = new URLSearchParams(req.body);
    assert.equal(body.get('grant_type'), 'authorization_code');
    assert.equal(body.get('code'), 'the-code');
    assert.equal(body.get('redirect_uri'), 'https://www.nunezdev.com/api/thumbtack/callback');
    assert.equal(body.get('code_verifier'), 'verifier');
  });

  it('builds a refresh_token request', () => {
    const req = buildRefreshRequest(TEST_CFG, 'rt-123');
    assert.equal(req.url, 'https://staging-auth.thumbtack.com/oauth2/token');
    assert.equal(req.headers.Authorization, expectedBasic);
    const body = new URLSearchParams(req.body);
    assert.equal(body.get('grant_type'), 'refresh_token');
    assert.equal(body.get('refresh_token'), 'rt-123');
  });
});

describe('token expiry math', () => {
  it('computeExpiresAtMs adds expires_in seconds (defaulting to 3600)', () => {
    assert.equal(computeExpiresAtMs(100, 1_000_000), 1_000_000 + 100_000);
    assert.equal(computeExpiresAtMs(undefined, 1_000_000), 1_000_000 + 3_600_000);
    assert.equal(computeExpiresAtMs(0, 1_000_000), 1_000_000 + 3_600_000); // guard against 0/negative
  });

  it('isAccessTokenExpired treats tokens within the 60s margin as expired', () => {
    const now = 1_000_000;
    assert.equal(isAccessTokenExpired(now + 120_000, now), false); // 2 min out -> fresh
    assert.equal(isAccessTokenExpired(now + 30_000, now), true); // 30s out -> within margin
    assert.equal(isAccessTokenExpired(now - 1, now), true); // already past
  });
});

describe('CRUD validation short-circuit (no network/DB)', () => {
  const realFetch = globalThis.fetch;
  const boom = (async () => {
    throw new Error('fetch/DB must not be reached for an invalid phone');
  }) as typeof fetch;

  it('createAssociatePhoneNumber rejects a bad phone before any call', async () => {
    globalThis.fetch = boom;
    try {
      await assert.rejects(
        () => createAssociatePhoneNumber('123', { phoneNumber: '4055551234' }, { cfg: TEST_CFG }),
        /E\.164 US format/
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('bulkCreate rejects the whole batch if any number is invalid', async () => {
    globalThis.fetch = boom;
    try {
      await assert.rejects(
        () =>
          bulkCreateAssociatePhoneNumbers(
            '123',
            [{ phoneNumber: '+14055551234' }, { phoneNumber: 'bad' }],
            { cfg: TEST_CFG }
          ),
        /E\.164 US format/
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('sendThumbtackMessage rejects empty text before any call', async () => {
    globalThis.fetch = boom;
    try {
      await assert.rejects(
        () => sendThumbtackMessage('neg1', '   ', { cfg: TEST_CFG }),
        /text is required/
      );
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
