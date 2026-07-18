import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONNAIRE_FIELDS,
  REQUIRED_QUESTIONNAIRE_FIELDS,
  missingRequiredAnswers,
  formatQuestionnaireText,
  renderQuestionnaireHtml,
  escapeHtml,
  buildLeadNote,
  appendToNotes,
} from './questionnaire';

function validAnswers(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Jane Doe',
    email: 'jane@business.com',
    business: 'Acme Roofing LLC — roof replacement',
    publicContact: 'info@acme.com / (555) 123-4567',
    ...overrides,
  };
}

test('field names are unique', () => {
  const names = QUESTIONNAIRE_FIELDS.map((f) => f.name);
  assert.equal(new Set(names).size, names.length);
});

test('every select field defines options', () => {
  for (const field of QUESTIONNAIRE_FIELDS) {
    if (field.type === 'select') {
      assert.ok(field.options?.length, `${field.name} is a select with no options`);
    }
  }
});

test('required list matches the fields marked required', () => {
  assert.deepEqual(REQUIRED_QUESTIONNAIRE_FIELDS, [
    'name',
    'email',
    'business',
    'publicContact',
  ]);
});

test('missingRequiredAnswers returns [] for a complete submission', () => {
  assert.deepEqual(missingRequiredAnswers(validAnswers()), []);
});

test('missingRequiredAnswers flags blank, whitespace, and non-string values', () => {
  const answers = validAnswers({ business: '   ', publicContact: undefined, name: 42 });
  assert.deepEqual(missingRequiredAnswers(answers), ['name', 'business', 'publicContact']);
});

test('optional fields left blank never block submission', () => {
  // Only the four required answers are present — no optional ones at all.
  assert.deepEqual(missingRequiredAnswers(validAnswers()), []);
});

test('formatQuestionnaireText omits unanswered optional fields', () => {
  const text = formatQuestionnaireText(validAnswers({ domain: 'acme.com' }));
  assert.match(text, /Current domain or URL:\nacme\.com/);
  // 'examples' was left blank, so its label must not appear at all.
  assert.doesNotMatch(text, /Three websites you like/);
});

test('formatQuestionnaireText preserves answer order and trims values', () => {
  const text = formatQuestionnaireText(validAnswers({ name: '  Jane Doe  ' }));
  assert.ok(text.startsWith('Your name:\nJane Doe\n\n'));
  assert.ok(text.indexOf('Email:') < text.indexOf('Acme Roofing'));
});

test('escapeHtml neutralizes tags and quotes', () => {
  assert.equal(
    escapeHtml(`<script>alert("x" & 'y')</script>`),
    '&lt;script&gt;alert(&quot;x&quot; &amp; &#39;y&#39;)&lt;/script&gt;'
  );
});

test('renderQuestionnaireHtml escapes untrusted answers', () => {
  // Public form input lands in an inbox — a raw <img onerror> must not survive.
  const html = renderQuestionnaireHtml(
    validAnswers({ additional: '<img src=x onerror=alert(1)>' })
  );
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('buildLeadNote stamps the date and includes the answers', () => {
  const note = buildLeadNote(validAnswers(), new Date('2026-07-18T15:04:00Z'));
  assert.ok(note.startsWith('--- Website questionnaire (2026-07-18) ---\n'));
  assert.match(note, /Jane Doe/);
});

test('appendToNotes preserves existing notes', () => {
  assert.equal(appendToNotes('Called 7/1, left VM.', 'NOTE'), 'Called 7/1, left VM.\n\nNOTE');
});

test('appendToNotes handles null, undefined, and whitespace-only notes', () => {
  assert.equal(appendToNotes(null, 'NOTE'), 'NOTE');
  assert.equal(appendToNotes(undefined, 'NOTE'), 'NOTE');
  assert.equal(appendToNotes('   \n ', 'NOTE'), 'NOTE');
});
