export function stageToProgress(stage?: string | null): number {
  switch (stage) {
    case 'Contacted': return 15;
    case 'Negotiation': return 40;
    case 'Contract Sent': return 70;
    case 'Contract Signed': return 90;
    case 'Won': return 100;
    case 'Lost': return 0;
    case 'Abandoned': return 0;
    default: return 0;
  }
}
export function currency(cents: number | null | undefined): string {
  const v = Math.max(0, Number(cents ?? 0)) / 100;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
