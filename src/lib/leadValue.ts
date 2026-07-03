// Estimated monetary value of a lead, in USD, for Google Ads conversion
// tracking. Attaching a real (differentiated) value to the `generate_lead`
// event lets Smart Bidding optimize toward *revenue* instead of counting every
// form-fill equally — a $10k custom-software lead should outweigh a $1,200
// brochure-site lead in the bidding math.
//
// The numbers are EXPECTED value = rough deal midpoint × an assumed ~15% close
// rate for cold ad leads. They're deliberately conservative and, above all,
// correctly *ordered* — the relative ranking is what steers bidding. Revisit
// the close-rate assumption once real close data exists.
//
// This only sets the value the event carries. For it to reach Google Ads, the
// imported conversion must be set to "Use different values for each conversion"
// in the Ads UI, and the GA4 key event must forward the `value`/`currency`.

export interface LeadValueInput {
  budget?: string | null;
  projectType?: string | null;
  source?: string | null;
}

// Deal-size signal — the budget bracket the visitor picked (strings come from
// LeadForm's BUDGET_RANGES). Ordered most- to least-specific so the "$10,000+"
// bracket isn't swallowed by a looser "10,000" match.
function valueFromBudget(budget: string): number | null {
  const b = budget.replace(/\s/g, "");
  if (b.includes("10,000+")) return 1800; // $10,000+
  if (b.includes("10,000")) return 1100; // $5,000 – $10,000
  if (b.includes("5,000")) return 550; //  $2,500 – $5,000
  if (b.includes("2,500") || b.includes("1,200")) return 300; // $1,200 – $2,500
  return null; // "Need help scoping" / unknown → fall through
}

// Software / CRM / automation work skews higher-value and is the strategic
// focus, so software leads without a budget signal get a higher default than a
// generic website inquiry.
function isSoftwareLead({ projectType, source }: LeadValueInput): boolean {
  if (source === "custom_software") return true;
  const t = (projectType ?? "").toLowerCase();
  return /crm|web app|dashboard|automation|api|portal/.test(t);
}

export function estimateLeadValue(input: LeadValueInput): number {
  const byBudget = input.budget ? valueFromBudget(input.budget) : null;
  if (byBudget != null) return byBudget;
  if (isSoftwareLead(input)) return 800;
  return 400;
}
