export function currency(cents: number | null | undefined): string {
  const v = Math.max(0, Number(cents ?? 0)) / 100;
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}
export function prettyDate(iso?: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString();
}
