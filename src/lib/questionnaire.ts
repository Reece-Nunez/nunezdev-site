// Website requirement-gathering questionnaire.
//
// Single source of truth for the question set. The client form (see
// app/questionnaire/QuestionnaireClient.tsx), the notification email, and the
// text appended to the lead's notes are all generated from QUESTIONNAIRE_FIELDS
// so a question can never render on the form but go missing from the email.

export type QuestionnaireFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select';

export interface QuestionnaireField {
  /** Payload key. Also the form input `name`. */
  name: string;
  label: string;
  type: QuestionnaireFieldType;
  required?: boolean;
  placeholder?: string;
  /** Helper copy shown under the input. */
  help?: string;
  /** Options for `type: 'select'`. */
  options?: string[];
  /** Rows for `type: 'textarea'`. */
  rows?: number;
}

/**
 * Question order matches how the conversation actually goes: who you are,
 * what exists today, what we're building, then the assets and the details we
 * need before a single line of code gets written.
 */
export const QUESTIONNAIRE_FIELDS: QuestionnaireField[] = [
  {
    name: 'name',
    label: 'Your name',
    type: 'text',
    required: true,
    placeholder: 'Jane Doe',
  },
  {
    name: 'email',
    label: 'Email',
    type: 'email',
    required: true,
    placeholder: 'jane@business.com',
    help: "We'll send you a copy of your answers at this address.",
  },
  {
    name: 'business',
    label: 'Exact name of your business, and the products or services you sell',
    type: 'textarea',
    required: true,
    rows: 3,
    placeholder:
      'Acme Roofing LLC — residential roof replacement, storm damage repair, and gutter installation.',
    help: 'Spell the business name exactly as it should appear on the site.',
  },
  {
    name: 'domain',
    label: 'Current domain or URL',
    type: 'text',
    placeholder: 'acmeroofing.com (or "none yet")',
    help: "If you don't have one yet, say so and we'll help you pick one.",
  },
  {
    name: 'platform',
    label: 'Platform or CMS preference',
    type: 'select',
    options: [
      'No preference — recommend one',
      'Custom build (Next.js)',
      'WordPress',
      'Shopify',
      'Wix / Squarespace',
      'Other (described below)',
    ],
  },
  {
    name: 'ecommerce',
    label: 'Will the site sell products or accept payments?',
    type: 'textarea',
    rows: 3,
    placeholder:
      'Yes — about 40 products, need Stripe checkout and shipping rates. (Or: No, quote requests only.)',
    help: 'If yes, describe what you sell and how you want to get paid.',
  },
  {
    name: 'pageCount',
    label: 'Roughly how many pages?',
    type: 'select',
    options: [
      '1 (single-page site)',
      '2 – 5',
      '6 – 10',
      '11 – 20',
      '20+',
      'Not sure yet',
    ],
  },
  {
    name: 'pageNames',
    label: 'What pages do you want?',
    type: 'textarea',
    rows: 3,
    placeholder: 'Home, About, Services, Gallery, Reviews, Contact',
  },
  {
    name: 'content',
    label: 'Who is writing the content?',
    type: 'select',
    options: [
      "I'll provide all the copy",
      'I have some copy, need help with the rest',
      'I need copywriting done for me',
      'Not sure yet',
    ],
    help: 'Text for each page — headlines, service descriptions, your story.',
  },
  {
    name: 'images',
    label: 'Do you own the photos for the site?',
    type: 'select',
    options: [
      'Yes — I have my own photos',
      'Some of my own, will need stock for the rest',
      'No — I need stock photography',
      'I want a photo shoot arranged',
      'Not sure yet',
    ],
  },
  {
    name: 'branding',
    label: 'Do you have a logo, brand colors, or brand guidelines?',
    type: 'textarea',
    rows: 3,
    placeholder:
      'Logo in PNG and SVG, brand colors are navy #1B2A4A and gold #C9A227. No formal guidelines doc.',
    help: "You can email the files to reece@nunezdev.com after you submit — just describe what you have here.",
  },
  {
    name: 'examples',
    label: 'Three websites you like, and what you like about each',
    type: 'textarea',
    rows: 5,
    placeholder:
      '1. example.com — love how clean the hero is\n2. another.com — the way services are laid out\n3. third.com — the color palette',
    help: 'This is the single most useful answer on the form. Competitors count.',
  },
  {
    name: 'publicContact',
    label: 'Email, phone, and address to display publicly on the site',
    type: 'textarea',
    required: true,
    rows: 3,
    placeholder:
      'info@acmeroofing.com\n(555) 123-4567\n123 Main St, Ponca City, OK 74601',
    help: 'Use "none" for anything you would rather not publish.',
  },
  {
    name: 'additional',
    label: 'Anything else that would help us understand the project',
    type: 'textarea',
    rows: 4,
    placeholder:
      'Deadlines, a launch event, integrations you need, things you hated about your last site...',
  },
];

export const REQUIRED_QUESTIONNAIRE_FIELDS = QUESTIONNAIRE_FIELDS.filter(
  (f) => f.required
).map((f) => f.name);

export type QuestionnaireAnswers = Record<string, unknown>;

/** Trim a raw answer to a string; non-strings and blanks collapse to ''. */
function answerToString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Names of required fields the submitter left blank. Empty array means valid.
 * Callers use this for both the client-side check and the server-side 400.
 */
export function missingRequiredAnswers(answers: QuestionnaireAnswers): string[] {
  return QUESTIONNAIRE_FIELDS.filter(
    (f) => f.required && !answerToString(answers[f.name])
  ).map((f) => f.name);
}

/**
 * Human-readable "Label: answer" blocks, skipping unanswered optional fields
 * so a half-filled form doesn't produce a wall of "Not provided".
 */
export function formatQuestionnaireText(answers: QuestionnaireAnswers): string {
  return QUESTIONNAIRE_FIELDS.map((field) => {
    const value = answerToString(answers[field.name]);
    if (!value) return null;
    return `${field.label}:\n${value}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

/** Escape for interpolation into an HTML email body. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The answer table shared by the owner notification and the submitter's copy.
 * Answers are escaped — this is untrusted public input landing in an inbox.
 */
export function renderQuestionnaireHtml(answers: QuestionnaireAnswers): string {
  return QUESTIONNAIRE_FIELDS.map((field) => {
    const value = answerToString(answers[field.name]);
    if (!value) return null;
    return `
      <div style="margin: 0 0 18px 0;">
        <p style="margin: 0 0 4px 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;">${escapeHtml(
          field.label
        )}</p>
        <p style="margin: 0; color: #222; font-size: 15px; white-space: pre-wrap;">${escapeHtml(
          value
        )}</p>
      </div>`;
  })
    .filter(Boolean)
    .join('');
}

/**
 * Block appended to an existing lead's `notes` column. Dated so multiple
 * submissions from the same client stack readably instead of overwriting.
 */
export function buildLeadNote(
  answers: QuestionnaireAnswers,
  submittedAt: Date
): string {
  const stamp = submittedAt.toISOString().slice(0, 10);
  return `--- Website questionnaire (${stamp}) ---\n${formatQuestionnaireText(
    answers
  )}`;
}

/**
 * Append the questionnaire to whatever notes already exist. Kept pure so the
 * append-vs-create branch is testable without a database.
 */
export function appendToNotes(
  existingNotes: string | null | undefined,
  note: string
): string {
  const existing = (existingNotes ?? '').trim();
  return existing ? `${existing}\n\n${note}` : note;
}
