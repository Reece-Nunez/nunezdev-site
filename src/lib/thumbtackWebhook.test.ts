/**
 * Unit tests for the Thumbtack webhook secret verification. Run with:
 *
 *   npm test
 *
 * No DB, no network. These pin the security contract for a PUBLIC endpoint:
 * only a request carrying the exact configured secret is accepted, and any
 * misconfiguration fails closed (rejects) rather than open.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { verifyWebhookSecret } from './thumbtackWebhook';

const SECRET = 'dbc179b2d0bdccbcb502db060647becc50db99c1607c3429f3fe77b7a9498d6a';

describe('verifyWebhookSecret', () => {
  it('accepts a bare secret (Custom Header config)', () => {
    assert.equal(verifyWebhookSecret(SECRET, SECRET), true);
  });

  it('accepts a "Bearer <secret>" header (Bearer config)', () => {
    assert.equal(verifyWebhookSecret(`Bearer ${SECRET}`, SECRET), true);
    // Bearer match is case-insensitive on the scheme token.
    assert.equal(verifyWebhookSecret(`bearer ${SECRET}`, SECRET), true);
  });

  it('rejects a wrong secret', () => {
    assert.equal(verifyWebhookSecret('not-the-secret', SECRET), false);
  });

  it('rejects a secret with a trailing/leading difference', () => {
    assert.equal(verifyWebhookSecret(`${SECRET}x`, SECRET), false);
    assert.equal(verifyWebhookSecret(SECRET.slice(0, -1), SECRET), false);
  });

  it('rejects an empty / missing header', () => {
    assert.equal(verifyWebhookSecret('', SECRET), false);
    assert.equal(verifyWebhookSecret(null, SECRET), false);
    assert.equal(verifyWebhookSecret(undefined, SECRET), false);
    assert.equal(verifyWebhookSecret('Bearer ', SECRET), false);
  });

  it('fails closed when no secret is configured', () => {
    // A deploy that forgot THUMBTACK_WEBHOOK_SECRET must reject everything,
    // never accept all callers.
    assert.equal(verifyWebhookSecret(SECRET, undefined), false);
    assert.equal(verifyWebhookSecret(SECRET, ''), false);
    assert.equal(verifyWebhookSecret('', undefined), false);
  });
});
