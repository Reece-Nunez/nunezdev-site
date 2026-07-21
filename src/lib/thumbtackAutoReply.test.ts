/**
 * Unit tests for the instant new-lead auto-reply helpers. Run with `npm test`.
 *
 * Covers the pure, network-free seams: the compliance sanitizer (no off-platform
 * contact info may go out in a Thumbtack message), the templated fallback, and
 * the enable flag. The AI + send orchestration is exercised end-to-end in
 * staging, not unit-mocked here.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stripContactInfo, buildTemplatedReply, autoReplyEnabled } from './thumbtackAutoReply';

describe('stripContactInfo', () => {
  it('removes phone numbers in various formats', () => {
    assert.ok(!/\d/.test(stripContactInfo('Call me at 405-555-1234 today')));
    assert.ok(!/\d/.test(stripContactInfo('reach me: (405) 555 1234')));
    assert.ok(!/\d/.test(stripContactInfo('+1 405 555 1234')));
  });

  it('removes emails and URLs', () => {
    assert.ok(!stripContactInfo('email reece@nunezdev.com please').includes('@'));
    assert.ok(!/http/i.test(stripContactInfo('see https://nunezdev.com/work')));
    assert.ok(!/www\./i.test(stripContactInfo('visit www.nunezdev.com now')));
  });

  it('drops a dangling "call me at" once the number is gone', () => {
    const out = stripContactInfo('Happy to help. Call me at 4055551234');
    assert.ok(!/call me at/i.test(out));
    assert.ok(out.startsWith('Happy to help'));
  });

  it('leaves ordinary copy intact and tidy', () => {
    assert.equal(
      stripContactInfo('Hi Jordan, thanks for reaching out. When works for a quick call?'),
      'Hi Jordan, thanks for reaching out. When works for a quick call?'
    );
  });
});

describe('buildTemplatedReply', () => {
  it('greets by first name and references the project type', () => {
    const msg = buildTemplatedReply({ leadName: 'Jordan Lee', projectType: 'a new website' });
    assert.ok(msg.startsWith('Hi Jordan,'));
    assert.ok(msg.includes('about a new website'));
    assert.ok(/quick call/i.test(msg));
  });

  it('degrades gracefully with no name or project type', () => {
    const msg = buildTemplatedReply({});
    assert.ok(msg.startsWith('Hi, '));
    assert.ok(!msg.includes('about '));
  });

  it('never contains off-platform contact info (safe to send as-is)', () => {
    const msg = buildTemplatedReply({ leadName: 'Sam', projectType: 'a dashboard' });
    assert.equal(stripContactInfo(msg), msg);
  });
});

describe('autoReplyEnabled', () => {
  it('is off unless THUMBTACK_AUTO_REPLY === "true"', () => {
    assert.equal(autoReplyEnabled({}), false);
    assert.equal(autoReplyEnabled({ THUMBTACK_AUTO_REPLY: 'false' }), false);
    assert.equal(autoReplyEnabled({ THUMBTACK_AUTO_REPLY: '1' }), false);
    assert.equal(autoReplyEnabled({ THUMBTACK_AUTO_REPLY: 'true' }), true);
  });
});
