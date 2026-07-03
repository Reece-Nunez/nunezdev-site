/**
 * The default SMS body for sharing a proposal link. Pure (no server imports)
 * so both the send route (via proposalSms.ts) and the dashboard modal that
 * previews the text can build the same message. Mirrors invoiceShareMessage.ts.
 *
 * House style: no em dashes, link-forward, plain-spoken.
 */
export function buildProposalShareMessage(p: {
  clientName?: string | null;
  proposalTitle?: string | null;
  amountCents: number;
  url: string;
}): string {
  const hi = p.clientName ? `Hi ${p.clientName}, ` : '';
  const amount = `$${(p.amountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  const what = p.proposalTitle
    ? `your proposal "${p.proposalTitle}" (${amount})`
    : `your proposal (${amount})`;
  return `${hi}here is ${what} from NunezDev. View and accept it here: ${p.url}`;
}
