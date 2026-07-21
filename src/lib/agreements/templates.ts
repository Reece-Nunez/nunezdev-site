/**
 * Reusable agreement templates + the placeholder-fill helper.
 *
 * A template is a title + summary + ordered `sections` whose text may contain
 * `{{PLACEHOLDER}}` tokens. "Load template" in the dashboard form fills the
 * tokens it knows (e.g. CLIENT_NAME from the selected client) and drops the
 * result into the editable sections editor — so any wording, number, or
 * still-unfilled token can be tweaked inline before sending. The sections
 * editor is the customization surface; templates are just a strong starting
 * point, not a locked form.
 */

import type { AgreementSection } from '@/types/agreements';

export interface AgreementTemplate {
  id: string;
  /** Shown in the "Load template" menu. */
  name: string;
  /** One-line description under the name. */
  description: string;
  title: string;
  summary: string;
  sections: AgreementSection[];
}

/** Replace every `{{KEY}}` in a string with vars[KEY]. Unknown tokens are left
 *  intact on purpose, so the operator can see and fill them in the editor. */
export function fillString(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}

/** Apply placeholder vars across a template's title, summary, and every
 *  section (heading + body). Returns plain fields ready to seed the form. */
export function fillTemplate(
  template: AgreementTemplate,
  vars: Record<string, string>,
): { title: string; summary: string; sections: AgreementSection[] } {
  return {
    title: fillString(template.title, vars),
    summary: fillString(template.summary, vars),
    sections: template.sections.map((s) => ({
      heading: fillString(s.heading, vars),
      body: fillString(s.body, vars),
    })),
  };
}

const SCANNER_PARTNERSHIP: AgreementTemplate = {
  id: 'scanner-subscription-partnership',
  name: 'Partnership Terms Sheet — Subscription Platform',
  description: 'Upfront build fee + revenue share, bilateral partnership with buyout terms.',
  title: 'Partnership Terms Sheet — Custom Scanner Subscription Platform',
  summary:
    "A partnership to build, launch, and maintain a custom subscription platform for {{CLIENT_NAME}}'s trading scanner product — a plain-language summary to align before work begins.",
  sections: [
    {
      heading: 'Parties',
      body: 'Reece Nunez (NunezDev) — "Developer"\n{{CLIENT_NAME}} — "Owner"',
    },
    {
      heading: 'The arrangement, in short',
      body:
        "A partnership, not a one-off build: the Owner pays a small upfront fee plus a share of new revenue, and the Developer builds the platform and stays on as the Owner's engineer — maintaining and improving it with a direct stake in its growth.",
    },
    {
      heading: "What's being built",
      body:
        '• Branded, own-domain website with subscriber accounts and login\n' +
        '• Gated dashboard delivering scanner results to active subscribers only\n' +
        '• Subscription billing (recurring charges, renewals, cancellations, customer portal)\n' +
        '• Per-scanner access control and a basic admin view — built to support multiple scanners\n' +
        '• Setup and configuration of a dedicated server (VPS) to host the site and run the scanner — reverse proxy, SSL, domain, and scheduling',
    },
    {
      heading: 'Upfront build fee',
      body: '$2,000, paid 50% ($1,000) on start and 50% ($1,000) at launch.',
    },
    {
      heading: 'Revenue share',
      body:
        '20% of net revenue (after payment-processing fees) on new subscriptions that begin after launch.\n\n' +
        "• The Owner's existing subscribers stay 100% the Owner's. The subscriber list is snapshotted on launch day; everyone on it (currently {{EXISTING_SUBS}}) is permanently excluded from the revenue share.\n" +
        '• "New subscription" means new revenue, not a new person. If a current customer buys an additional scanner or upgrades their tier through the new platform, that new subscription is included.\n' +
        '• Scanners covered: {{SCANNERS_COVERED}} (define whether the share applies to this scanner only, or to all scanners sold through the platform).',
    },
    {
      heading: 'Term, buyout & ongoing role',
      body:
        '• Minimum term: the revenue share runs for at least 12 months before it can be bought out.\n' +
        '• Buyout: after the minimum term, the Owner may end the revenue share with a one-time payment equal to the greater of $4,500 or 18 months of the trailing average monthly share. After buyout, the Owner owns the platform outright with no further obligation.\n' +
        '• Ongoing support: for as long as the revenue share is active, the Developer maintains the platform (updates, fixes, reasonable improvements) as the Owner\'s engineer.',
    },
    {
      heading: 'Hosting & reporting',
      body:
        '• The Owner covers the VPS/hosting cost directly (~$5–6/month at launch volume) and supplies the domain (~$12–15/year).\n' +
        '• The Developer receives read-access to the payment dashboard (Stripe and/or Whop) to verify subscriber counts and revenue-share amounts.',
    },
    {
      heading: 'Future add-ons (separately scoped)',
      body:
        'Features beyond the core platform — e.g. real-time social/news monitoring, or replacing the CrossTrade execution bridge — are quoted and agreed separately, given their added complexity and testing needs.',
    },
  ],
};

export const AGREEMENT_TEMPLATES: AgreementTemplate[] = [SCANNER_PARTNERSHIP];

/** Default placeholder values for a template. CLIENT_NAME is filled from the
 *  selected client at load time; the rest are sensible starting values the
 *  operator can edit inline. */
export const TEMPLATE_DEFAULT_VARS: Record<string, string> = {
  EXISTING_SUBS: '18',
  SCANNERS_COVERED: '________________',
};

export function getAgreementTemplate(id: string): AgreementTemplate | undefined {
  return AGREEMENT_TEMPLATES.find((t) => t.id === id);
}
