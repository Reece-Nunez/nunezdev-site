// Website requirement-gathering questionnaire.
//
// Single source of truth for the question set. The client form (see
// app/questionnaire/QuestionnaireClient.tsx), the notification email, and the
// text appended to the lead's notes are all generated from QUESTIONNAIRE_FIELDS
// so a question can never render on the form but go missing from the email.
//
// Design rule enforced here: one field asks for exactly one thing. A field that
// wants "email, phone and address" or "business name and services" is really
// three questions sharing a box, which reads as lazy and returns mush that has
// to be untangled by hand later.

export type QuestionnaireFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select';

/** Section ids, in render order. */
export type QuestionnaireSectionId =
  | 'you'
  | 'business'
  | 'site'
  | 'assets'
  | 'public'
  | 'extra';

export interface QuestionnaireSection {
  id: QuestionnaireSectionId;
  /** Ordinal shown in the section head. Long-Document numbering. */
  number: string;
  title: string;
  /** One line under the title explaining why the section is being asked. */
  blurb: string;
}

/**
 * Six sections instead of one 15-question wall. Grouping is the single biggest
 * completion lever on a long form: a section the visitor can't answer gets
 * skipped rather than abandoning the whole page.
 */
export const QUESTIONNAIRE_SECTIONS: QuestionnaireSection[] = [
  {
    id: 'you',
    number: '01',
    title: 'About you',
    blurb: "So I know who I'm talking to and where to send your copy.",
  },
  {
    id: 'business',
    number: '02',
    title: 'Your business',
    blurb: 'What you sell, and where you are online today.',
  },
  {
    id: 'site',
    number: '03',
    title: 'The website',
    blurb: 'Shape and scope. Rough answers are fine — this is what we refine on the call.',
  },
  {
    id: 'assets',
    number: '04',
    title: 'Content and assets',
    blurb: "What already exists, and what we'll need to create.",
  },
  {
    id: 'public',
    number: '05',
    title: 'Details to publish',
    blurb: 'What visitors will actually see on the site. Leave blank anything you would rather keep private.',
  },
  {
    id: 'extra',
    number: '06',
    title: 'Anything else',
    blurb: 'The things no form thinks to ask about.',
  },
];

export interface QuestionnaireField {
  /** Payload key. Also the form input `name`. */
  name: string;
  section: QuestionnaireSectionId;
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

export const QUESTIONNAIRE_FIELDS: QuestionnaireField[] = [
  // 01 — About you
  {
    name: 'name',
    section: 'you',
    label: 'Your name',
    type: 'text',
    required: true,
    placeholder: 'Jane Doe',
  },
  {
    name: 'email',
    section: 'you',
    label: 'Your email',
    type: 'email',
    required: true,
    placeholder: 'jane@business.com',
    help: "Where I'll send your copy of these answers and my reply.",
  },

  // 02 — Your business
  {
    name: 'businessName',
    section: 'business',
    label: 'Business name',
    type: 'text',
    required: true,
    placeholder: 'Acme Roofing LLC',
    help: 'Spelled exactly as it should appear on the site.',
  },
  {
    name: 'services',
    section: 'business',
    label: 'What do you sell?',
    type: 'textarea',
    required: true,
    rows: 3,
    placeholder:
      'Residential roof replacement, storm damage repair, and gutter installation.',
    help: 'Your products or services — the things a visitor would hire you for.',
  },
  {
    name: 'domain',
    section: 'business',
    label: 'Current website',
    type: 'text',
    placeholder: 'acmeroofing.com',
    help: "Leave blank if you don't have one yet — we'll help you pick a domain.",
  },

  // 03 — The website
  {
    name: 'platform',
    section: 'site',
    label: 'Platform preference',
    type: 'select',
    options: [
      'No preference — recommend one',
      'Custom build (fastest, best for SEO)',
      'WordPress',
      'Shopify',
      'Wix or Squarespace',
      'Other — noted below',
    ],
    help: 'Most people pick the first one. Only choose a platform if you need it for a reason.',
  },
  {
    name: 'pages',
    section: 'site',
    label: 'What pages do you need?',
    type: 'textarea',
    rows: 3,
    placeholder: 'Home, About, Services, Gallery, Reviews, Contact',
    help: "Just list them — I'll tell you what's missing and what can be merged.",
  },
  {
    name: 'ecommerce',
    section: 'site',
    label: 'Will the site take payments?',
    type: 'select',
    options: [
      'No — informational site only',
      'Yes — physical products',
      'Yes — digital products or downloads',
      'Yes — services, bookings, or deposits',
      'Not sure yet',
    ],
  },

  // 04 — Content and assets
  {
    name: 'content',
    section: 'assets',
    label: "Who's writing the words?",
    type: 'select',
    options: [
      "I'll provide all the copy",
      'I have some, need help with the rest',
      'I need it written for me',
      'Not sure yet',
    ],
    help: 'Headlines, service descriptions, your story — the text on each page.',
  },
  {
    name: 'images',
    section: 'assets',
    label: 'Where are the photos coming from?',
    type: 'select',
    options: [
      'I have my own photos',
      'Some of mine, stock for the rest',
      'I need stock photography',
      "I'd like a photo shoot arranged",
      'Not sure yet',
    ],
  },
  {
    name: 'branding',
    section: 'assets',
    label: 'Logo, brand colors, or guidelines',
    type: 'textarea',
    rows: 3,
    placeholder: 'Logo in PNG and SVG. Colors are navy #1B2A4A and gold #C9A227.',
    help: 'Describe what you have — you can email the actual files after you submit.',
  },
  {
    name: 'examples',
    section: 'assets',
    label: 'Three sites you like, and why',
    type: 'textarea',
    rows: 5,
    placeholder:
      '1. example.com — the hero is clean and gets out of the way\n2. another.com — services are easy to scan\n3. third.com — love the color palette',
    help: 'The most useful answer on this form. Competitors count, and so does what you dislike.',
  },

  // 05 — Details to publish
  {
    name: 'publicEmail',
    section: 'public',
    label: 'Email to display',
    type: 'email',
    required: true,
    placeholder: 'info@acmeroofing.com',
    help: 'Often the same as your email above — repeat it if so.',
  },
  {
    name: 'publicPhone',
    section: 'public',
    label: 'Phone to display',
    type: 'tel',
    placeholder: '(555) 123-4567',
    help: "Leave blank to keep a phone number off the site.",
  },
  {
    name: 'publicAddress',
    section: 'public',
    label: 'Address to display',
    type: 'text',
    placeholder: '123 Main St, Ponca City, OK 74601',
    help: 'Leave blank if you work from home or serve a whole region.',
  },

  // 06 — Anything else
  {
    name: 'additional',
    section: 'extra',
    label: 'Anything else I should know?',
    type: 'textarea',
    rows: 4,
    placeholder:
      'Deadlines, a launch event, software you need it to connect to, things you hated about your last site...',
  },
];

export const REQUIRED_QUESTIONNAIRE_FIELDS = QUESTIONNAIRE_FIELDS.filter(
  (f) => f.required
).map((f) => f.name);

/** Fields belonging to a section, in declaration order. */
export function fieldsForSection(
  sectionId: QuestionnaireSectionId
): QuestionnaireField[] {
  return QUESTIONNAIRE_FIELDS.filter((f) => f.section === sectionId);
}

export type QuestionnaireAnswers = Record<string, unknown>;

/** Trim a raw answer to a string; non-strings and blanks collapse to ''. */
function answerToString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Names of required fields the submitter left blank. Empty array means valid.
 * Drives the client's per-field error highlighting and the server's 400.
 */
export function missingRequiredAnswers(answers: QuestionnaireAnswers): string[] {
  return QUESTIONNAIRE_FIELDS.filter(
    (f) => f.required && !answerToString(answers[f.name])
  ).map((f) => f.name);
}

/**
 * Human-readable "Label: answer" blocks grouped under their section heading,
 * skipping unanswered optional fields so a half-filled form doesn't produce a
 * wall of "Not provided". Empty sections are dropped entirely.
 */
export function formatQuestionnaireText(answers: QuestionnaireAnswers): string {
  return QUESTIONNAIRE_SECTIONS.map((section) => {
    const lines = fieldsForSection(section.id)
      .map((field) => {
        const value = answerToString(answers[field.name]);
        return value ? `${field.label}:\n${value}` : null;
      })
      .filter(Boolean);
    if (!lines.length) return null;
    return `[${section.number}] ${section.title.toUpperCase()}\n\n${lines.join('\n\n')}`;
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
 * The sectioned answer table shared by the owner notification and the
 * submitter's copy. Answers are escaped — this is untrusted public input
 * landing in an inbox.
 */
export function renderQuestionnaireHtml(answers: QuestionnaireAnswers): string {
  return QUESTIONNAIRE_SECTIONS.map((section) => {
    const rows = fieldsForSection(section.id)
      .map((field) => {
        const value = answerToString(answers[field.name]);
        if (!value) return null;
        return `
      <div style="margin: 0 0 16px 0;">
        <p style="margin: 0 0 3px 0; color: #8a8a8a; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;">${escapeHtml(
          field.label
        )}</p>
        <p style="margin: 0; color: #1a1a1a; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(
          value
        )}</p>
      </div>`;
      })
      .filter(Boolean);
    if (!rows.length) return null;
    return `
    <div style="margin: 0 0 28px 0;">
      <p style="margin: 0 0 14px 0; padding-bottom: 8px; border-bottom: 1px solid #e4e4e4; color: #1a1a1a; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">
        <span style="color: #b8860b;">${section.number}</span>&nbsp;&nbsp;${escapeHtml(
      section.title
    )}
      </p>
      ${rows.join('')}
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
