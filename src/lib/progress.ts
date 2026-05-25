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
