// Registry of hand-built, bespoke proposal pages that live at their own static
// URL under /proposal/<slug> — as opposed to the DB-driven /proposal/[token]
// flow that the /dashboard/proposals table reads from.
//
// These pages are code (src/app/proposal/<slug>/page.tsx), not database rows, so
// they do NOT show up in the proposals table on their own. That made live
// proposal URLs easy to lose track of. Add an entry here whenever you ship a new
// custom proposal page, so every URL is visible in one place on the dashboard.
//
// Keep newest first.

export interface CustomProposal {
  /** Route segment under /proposal/ — must match the folder in src/app/proposal/ */
  slug: string;
  /** Person the proposal is prepared for */
  client: string;
  /** Their organization */
  company: string;
  /** Display amount, e.g. "$1,950" or "$2,950 / $2,200" for multi-option docs */
  amount: string;
  /** ISO date the proposal was prepared (YYYY-MM-DD) */
  preparedOn: string;
  /** Optional context: source, linked DB proposal number, notes */
  note?: string;
}

export const CUSTOM_PROPOSALS: CustomProposal[] = [
  {
    slug: 'campos-consulting-group',
    client: 'Lorena Campos',
    company: 'Campos Consulting Group',
    amount: '$1,950',
    preparedOn: '2026-07-22',
    note: 'Texas government-affairs firm (Thumbtack lead). Also tracked as PROP-2026-0009.',
  },
  {
    slug: 'legacy-training-consulting',
    client: 'Maria Roman',
    company: 'Legacy Training & Consulting',
    amount: '$2,950 / $2,200',
    preparedOn: '2026-07-21',
    note: 'Healthcare training & consulting (Thumbtack lead). Two-option custom + WordPress build.',
  },
];

/** Relative path to a custom proposal page. */
export function customProposalPath(slug: string): string {
  return `/proposal/${slug}`;
}
