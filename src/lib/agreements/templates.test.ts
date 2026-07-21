/**
 * Unit tests for agreement template placeholder-fill + body parsing. Run: npm test
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  fillString,
  fillTemplate,
  getAgreementTemplate,
  TEMPLATE_DEFAULT_VARS,
} from './templates';
import { parseAgreementBody } from './renderBody';

describe('fillString', () => {
  it('replaces known placeholders', () => {
    assert.equal(fillString('Hi {{NAME}}!', { NAME: 'Christian' }), 'Hi Christian!');
  });

  it('replaces every occurrence', () => {
    assert.equal(
      fillString('{{X}} and {{X}}', { X: 'a' }),
      'a and a',
    );
  });

  it('tolerates inner whitespace in the token', () => {
    assert.equal(fillString('{{ NAME }}', { NAME: 'C' }), 'C');
  });

  it('leaves unknown placeholders intact so the operator can fill them', () => {
    assert.equal(fillString('Hi {{NAME}}', {}), 'Hi {{NAME}}');
  });
});

describe('fillTemplate — scanner partnership', () => {
  const tmpl = getAgreementTemplate('scanner-subscription-partnership');

  it('exists', () => {
    assert.ok(tmpl, 'scanner-subscription-partnership template should exist');
  });

  it('fills CLIENT_NAME across summary and sections', () => {
    const out = fillTemplate(tmpl!, { CLIENT_NAME: 'Christian Nolff', ...TEMPLATE_DEFAULT_VARS });
    assert.ok(out.summary.includes('Christian Nolff'));
    const parties = out.sections.find((s) => s.heading === 'Parties');
    assert.ok(parties);
    assert.ok(parties!.body.includes('Christian Nolff'));
    // No CLIENT_NAME token should survive once provided.
    assert.ok(!JSON.stringify(out).includes('{{CLIENT_NAME}}'));
  });

  it('fills EXISTING_SUBS from default vars', () => {
    const out = fillTemplate(tmpl!, { CLIENT_NAME: 'X', ...TEMPLATE_DEFAULT_VARS });
    const rev = out.sections.find((s) => s.heading === 'Revenue share');
    assert.ok(rev!.body.includes('(currently 18)'));
  });

  it('leaves CLIENT_NAME visible when not provided', () => {
    const out = fillTemplate(tmpl!, {});
    assert.ok(JSON.stringify(out).includes('{{CLIENT_NAME}}'));
  });
});

describe('parseAgreementBody', () => {
  it('groups consecutive bullet lines into one list', () => {
    const blocks = parseAgreementBody('• one\n• two\n• three');
    assert.equal(blocks.length, 1);
    assert.deepEqual(blocks[0], { type: 'bullets', items: ['one', 'two', 'three'] });
  });

  it('supports "- " bullets and strips the marker', () => {
    const blocks = parseAgreementBody('- a\n- b');
    assert.deepEqual(blocks[0], { type: 'bullets', items: ['a', 'b'] });
  });

  it('separates a text intro from a following bullet list', () => {
    const blocks = parseAgreementBody('Intro line\n\n• a\n• b');
    assert.equal(blocks.length, 2);
    assert.deepEqual(blocks[0], { type: 'text', text: 'Intro line' });
    assert.deepEqual(blocks[1], { type: 'bullets', items: ['a', 'b'] });
  });

  it('keeps multi-line text together', () => {
    const blocks = parseAgreementBody('line one\nline two');
    assert.deepEqual(blocks, [{ type: 'text', text: 'line one\nline two' }]);
  });

  it('handles an empty body', () => {
    assert.deepEqual(parseAgreementBody(''), []);
  });
});
