import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUESTIONNAIRE_FIELDS,
  QUESTIONNAIRE_SECTIONS,
  REQUIRED_QUESTIONNAIRE_FIELDS,
  fieldsForSection,
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
    businessName: 'Acme Roofing LLC',
    services: 'Roof replacement and storm damage repair',
    publicEmail: 'info@acme.com',
    ...overrides,
  };
}

test('field names are unique', () => {
  const names = QUESTIONNAIRE_FIELDS.map((f) => f.name);
  assert.equal(new Set(names).size, names.length);
});

test('every field belongs to a declared section', () => {
  const sectionIds = new Set(QUESTIONNAIRE_SECTIONS.map((s) => s.id));
  for (const field of QUESTIONNAIRE_FIELDS) {
    assert.ok(sectionIds.has(field.section), `${field.name} has an unknown section`);
  }
});

test('every section has at least one field', () => {
  for (const section of QUESTIONNAIRE_SECTIONS) {
    assert.ok(fieldsForSection(section.id).length, `${section.id} renders empty`);
  }
});

test('section numbers are sequential and zero-padded', () => {
  assert.deepEqual(
    QUESTIONNAIRE_SECTIONS.map((s) => s.number),
    ['01', '02', '03', '04', '05', '06']
  );
});

test('every select field defines options', () => {
  for (const field of QUESTIONNAIRE_FIELDS) {
    if (field.type === 'select') {
      assert.ok(field.options?.length, `${field.name} is a select with no options`);
    }
  }
});

test('no field bundles multiple asks into one box', () => {
  // The redesign split "business name & services" and "email, phone and
  // address" into single-purpose fields. This pins that: a label joining two
  // nouns with "and"/"&"/"," is the smell that regression would reintroduce.
  for (const field of QUESTIONNAIRE_FIELDS) {
    assert.doesNotMatch(
      field.label,
      /\b(email|phone|address)\b.*\b(and|&|,)\b.*\b(email|phone|address)\b/i,
      `${field.name} bundles contact details into one field`
    );
  }
});

test('required list matches the fields marked required', () => {
  assert.deepEqual(REQUIRED_QUESTIONNAIRE_FIELDS, [
    'name',
    'email',
    'businessName',
    'services',
    'publicEmail',
  ]);
});

test('page count is not asked separately from the page list', () => {
  // Listing the pages IS the count — asking both was the redundancy.
  const names = QUESTIONNAIRE_FIELDS.map((f) => f.name);
  assert.ok(names.includes('pages'));
  assert.ok(!names.includes('pageCount'));
});

test('publicPhone and publicAddress are optional', () => {
  // Plenty of businesses deliberately publish neither.
  for (const name of ['publicPhone', 'publicAddress']) {
    const field = QUESTIONNAIRE_FIELDS.find((f) => f.name === name);
    assert.ok(field, `${name} missing`);
    assert.ok(!field.required, `${name} should not be required`);
  }
});

test('missingRequiredAnswers returns [] for a complete submission', () => {
  assert.deepEqual(missingRequiredAnswers(validAnswers()), []);
});

test('missingRequiredAnswers flags blank, whitespace, and non-string values', () => {
  const answers = validAnswers({ services: '   ', publicEmail: undefined, name: 42 });
  assert.deepEqual(missingRequiredAnswers(answers), ['name', 'services', 'publicEmail']);
});

test('formatQuestionnaireText groups answers under section headings', () => {
  const text = formatQuestionnaireText(validAnswers({ domain: 'acme.com' }));
  assert.match(text, /\[01\] ABOUT YOU/);
  assert.match(text, /\[02\] YOUR BUSINESS/);
  assert.match(text, /Current website:\nacme\.com/);
});

test('formatQuestionnaireText drops sections with no answers', () => {
  // Nothing in section 03/04/06 was answered, so those headings must not print.
  const text = formatQuestionnaireText(validAnswers());
  assert.doesNotMatch(text, /THE WEBSITE/);
  assert.doesNotMatch(text, /CONTENT AND ASSETS/);
  assert.doesNotMatch(text, /ANYTHING ELSE/);
  assert.match(text, /DETAILS TO PUBLISH/);
});

test('formatQuestionnaireText trims values and preserves field order', () => {
  const text = formatQuestionnaireText(validAnswers({ name: '  Jane Doe  ' }));
  assert.match(text, /Your name:\nJane Doe\n/);
  assert.ok(text.indexOf('Your name:') < text.indexOf('Business name:'));
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

test('renderQuestionnaireHtml omits sections with no answers', () => {
  const html = renderQuestionnaireHtml(validAnswers());
  assert.match(html, /About you/);
  assert.doesNotMatch(html, /Content and assets/);
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
